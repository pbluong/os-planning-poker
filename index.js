// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

let sessions = {};

function syncHostRole(taskId) {
  const session = sessions[taskId];
  if (!session) return;
  for (const client of io.sockets.sockets.values()) {
    if (client.data.membership?.taskId === taskId) {
      client.emit('isHost', client.id === session.hostSocketId);
    }
  }
}

app.use(express.static(path.join(__dirname, 'public')));

function createUserState() {
  return {
    voted: false,
    point: 0,
    estimation: null
  };
}

function sanitizeEstimation(estimation, vote) {
  if (!estimation || typeof estimation !== 'object') {
    return {
      suggestedStoryPoint: vote,
      finalScore: null,
      baseScore: null,
      boosterScore: null,
      domains: [],
      criteria: [],
      boosters: [],
      customCriteria: []
    };
  }

  return {
    suggestedStoryPoint: Number(estimation.suggestedStoryPoint ?? vote),
    finalScore: toNullableNumber(estimation.finalScore),
    baseScore: toNullableNumber(estimation.baseScore),
    boosterScore: toNullableNumber(estimation.boosterScore),
    domains: sanitizeArray(estimation.domains),
    criteria: sanitizeArray(estimation.criteria),
    boosters: sanitizeArray(estimation.boosters),
    customCriteria: sanitizeArray(estimation.customCriteria)
  };
}

function toNullableNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sanitizeArray(value) {
  return Array.isArray(value) ? value.slice(0, 100) : [];
}

function calculateAverageVote(votes) {
  const voteValues = Object.values(votes);
  if (voteValues.length === 0) return 0;

  const totalVotes = voteValues.reduce((acc, vote) => acc + vote, 0);
  return totalVotes / voteValues.length;
}

app.get('/getTaskInfo', (req, res) => {
  const taskId = req.query.taskId;
  // Find task details based on taskId (example only, use your actual data source)
  const task = sessions[taskId];
  if (task) {
    res.json({ taskId, taskDescription: task.taskDescription });
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  function leaveSession() {
    const membership = socket.data.membership;
    if (!membership) return;
    const { taskId, user } = membership;
    socket.leave(taskId);
    delete socket.data.membership;
    const session = sessions[taskId];
    if (!session) return;
    if (session.hostSocketId === socket.id) {
      delete sessions[taskId];
      for (const client of io.sockets.sockets.values()) {
        if (client.data.membership?.taskId !== taskId) continue;
        client.leave(taskId);
        delete client.data.membership;
        client.emit('sessionEnded', { taskId, host: user });
      }
      return;
    }
    delete session.users[user];
    delete session.votes[user];
    syncHostRole(taskId);
    io.to(taskId).emit('taskInfo', { taskId, taskDescription: session.taskDescription, users: session.users });
    io.to(taskId).emit('votesUpdate', session.users, session.revealed, calculateAverageVote(session.votes));
  }

  socket.on('leaveSession', (acknowledge) => {
    leaveSession();
    if (typeof acknowledge === 'function') acknowledge();
  });
  socket.on('disconnect', leaveSession);

  // Host initiates a task session
  socket.on('startTask', ({ taskId, taskDescription, user }) => {
    if (socket.data.membership) return;
    if (!taskId || !user) return socket.emit('taskError', 'Name and task ID are required.');
    if (sessions[taskId]) return socket.emit('taskError', 'Task already exists. Use Join a Task.');
    if (!sessions[taskId]) {
      sessions[taskId] = {
        taskDescription,
        host: user,
        hostSocketId: socket.id,
        revealed: false,
        votes: {},
        users: { [user]: createUserState() }
      };
    }
    socket.join(taskId);
    socket.data.membership = { taskId, user };
    socket.emit('sessionJoined', { taskId });
    io.to(taskId).emit('taskInfo', { taskId, taskDescription, users: sessions[taskId].users });
    syncHostRole(taskId);

    // Emit share link to host
    const shareLink = `https://os-planning-poker.onrender.com/?taskId=${taskId}`;
    socket.emit('shareLink', shareLink);
  });

  socket.on('joinTask', ({ taskId, user }) => {
    if (socket.data.membership) return;
    if (!taskId || !user) return socket.emit('taskError', 'Name and task ID are required.');
    // Check if the session exists
    if (!sessions[taskId]) {
      socket.emit('taskError', 'Task not found.');
      return;
    }
  
    if (sessions[taskId].users[user]) return socket.emit('taskError', 'This name is already in the session.');
    // Add the user to the session if not already added
    if (!sessions[taskId].users[user]) {
      sessions[taskId].users[user] = createUserState();
    }
    socket.join(taskId);
    socket.data.membership = { taskId, user };
    socket.emit('sessionJoined', { taskId });
    syncHostRole(taskId);
  
    // Send task info, including taskDescription, to the user
    socket.emit('taskInfo', {
      taskId,
      taskDescription: sessions[taskId].taskDescription,
      users: sessions[taskId].users
    });
  
    // Notify all clients in the session about the updated user list
    io.to(taskId).emit('userListUpdate', sessions[taskId].users);

    io.to(taskId).emit(
      'votesUpdate',
      sessions[taskId].users,
      sessions[taskId].revealed,
      calculateAverageVote(sessions[taskId].votes)
    );
  });

  // Handle vote casting, reveal, and reset as previously described
  socket.on('castVote', ({ taskId, user, vote, estimation }) => {
    if (socket.data.membership?.taskId !== taskId || socket.data.membership.user !== user) return;
    if (!sessions[taskId]) return;
    if (sessions[taskId].revealed) {
      socket.emit('votesLocked');
      return;
    }

    if (!sessions[taskId].users[user]) {
      sessions[taskId].users[user] = createUserState();
    }

    const numericVote = Number(vote);

    sessions[taskId].votes[user] = numericVote;
    sessions[taskId].users[user].voted = true;
    sessions[taskId].users[user].point = numericVote;
    sessions[taskId].users[user].estimation = sanitizeEstimation(estimation, numericVote);

    io.to(taskId).emit('votesUpdate', sessions[taskId].users, false);
    io.to(taskId).emit('taskInfo', {
      taskId,
      taskDescription: sessions[taskId].taskDescription,
      users: sessions[taskId].users
    });
  });

  socket.on('revealVotes', (taskId) => {
    if (socket.data.membership?.taskId !== taskId || sessions[taskId]?.hostSocketId !== socket.id) return;
    if (sessions[taskId]) {
      sessions[taskId].revealed = true;
      const averageVote = calculateAverageVote(sessions[taskId].votes);

      // Emit the votes and average vote to all users (including the host)
      io.to(taskId).emit('votesUpdate', sessions[taskId].users, true, averageVote);
    }
  });

  socket.on('resetVotes', (taskId) => {
    if (socket.data.membership?.taskId !== taskId || sessions[taskId]?.hostSocketId !== socket.id) return;
    if (sessions[taskId]) {
      sessions[taskId].votes = {};
      sessions[taskId].revealed = false;

      for (let user in sessions[taskId].users) {
        sessions[taskId].users[user].voted = false;
        sessions[taskId].users[user].point = 0;
        sessions[taskId].users[user].estimation = null;
      }

      io.to(taskId).emit('votesUpdate', sessions[taskId].users, false);
      io.to(taskId).emit('taskInfo', {
        taskId,
        taskDescription: sessions[taskId].taskDescription,
        users: sessions[taskId].users
      });
      io.to(taskId).emit('resetAllVotes', taskId);
    }
  });


});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
