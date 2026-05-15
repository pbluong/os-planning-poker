// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

let sessions = {};

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

app.get('/getTaskInfo', (req, res) => {
  const taskId = req.query.taskId;
  // Find task details based on taskId (example only, use your actual data source)
  const task = sessions[taskId];
  if (task) {
    res.json({ taskId: task.taskId, taskDescription: task.taskDescription });
  } else {
    res.status(404).json({ message: 'Task not found' });
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Host initiates a task session
  socket.on('startTask', ({ taskId, taskDescription, user }) => {
    if (!sessions[taskId]) {
      sessions[taskId] = {
        taskDescription,
        host: user,
        votes: {},
        users: { [user]: createUserState() }
      };
    }
    socket.join(taskId);
    io.to(taskId).emit('taskInfo', { taskId, taskDescription, users: sessions[taskId].users });
    socket.emit('isHost', true);

    // Emit share link to host
    const shareLink = `https://os-planning-poker.onrender.com/?taskId=${taskId}`;
    socket.emit('shareLink', shareLink);
  });

  socket.on('joinTask', ({ taskId, user }) => {
    // Check if the session exists
    if (!sessions[taskId]) {
      socket.emit('taskError', 'Task not found.');
      return;
    }
  
    // Add the user to the session if not already added
    if (!sessions[taskId].users[user]) {
      sessions[taskId].users[user] = createUserState();
    }
    socket.join(taskId);
  
    // Send task info, including taskDescription, to the user
    socket.emit('taskInfo', {
      taskId,
      taskDescription: sessions[taskId].taskDescription,
      users: sessions[taskId].users
    });
  
    // Notify all clients in the session about the updated user list
    io.to(taskId).emit('userListUpdate', sessions[taskId].users);

    io.to(taskId).emit('votesUpdate', sessions[taskId].users, false);
  });

  // Handle vote casting, reveal, and reset as previously described
  socket.on('castVote', ({ taskId, user, vote, estimation }) => {
    if (!sessions[taskId]) return;

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
    if (sessions[taskId]) {
      // Get all votes for the task session
      const votes = sessions[taskId].votes;
      
      // Calculate the average vote
      const totalVotes = Object.values(votes).reduce((acc, vote) => acc + vote, 0);
      const averageVote = totalVotes / Object.keys(votes).length;
  
      // Emit the votes and average vote to all users (including the host)
      io.to(taskId).emit('votesUpdate', sessions[taskId].users, true, averageVote);
    }
  });

  socket.on('resetVotes', (taskId) => {
    if (sessions[taskId]) {
      sessions[taskId].votes = {};

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
    }
  });


});

server.listen(3000, () => {
  console.log('Listening on http://localhost:3000');
});
