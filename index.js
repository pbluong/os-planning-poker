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

io.on('connection', (socket) => {
  console.log('A user connected');

  // Host initiates a task session
  socket.on('startTask', ({ taskId, taskDescription, user }) => {
    if (!sessions[taskId]) {
      sessions[taskId] = {
        taskDescription,
        host: user,
        votes: {},
        users: { [user]: { voted: false } }
      };
    }
    socket.join(taskId);
    io.to(taskId).emit('taskInfo', { taskId, taskDescription, users: sessions[taskId].users });
    socket.emit('isHost', true);

    // Emit share link to host
    const shareLink = `https://https://os-planning-poker.onrender.com?taskId=${taskId}`;
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
      sessions[taskId].users[user] = { voted: false };
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

    io.to(taskId).emit('votesUpdate', sessions[taskId].votes, false);
  });

  // Handle vote casting, reveal, and reset as previously described
  socket.on('castVote', ({ taskId, user, vote }) => {
    if (sessions[taskId]) {
      if (!sessions[taskId].users[user]) {
        sessions[taskId].users[user] = { voted: false };
      }
      sessions[taskId].votes[user] = vote;
      sessions[taskId].users[user].voted = true;

      io.to(taskId).emit('votesUpdate', sessions[taskId].votes, false);
      io.to(taskId).emit('taskInfo', { taskId, taskDescription: sessions[taskId].taskDescription, users: sessions[taskId].users });
    }
  });

  socket.on('revealVotes', (taskId) => {
    if (sessions[taskId]) {
      // Get all votes for the task session
      const votes = sessions[taskId].votes;
      
      // Calculate the average vote
      const totalVotes = Object.values(votes).reduce((acc, vote) => acc + vote, 0);
      const averageVote = totalVotes / Object.keys(votes).length;
  
      // Emit the votes and average vote to all users (including the host)
      io.to(taskId).emit('votesUpdate', votes, true, averageVote);
    }
  });

  socket.on('resetVotes', (taskId) => {
    if (sessions[taskId]) {
      sessions[taskId].votes = {};
      for (let user in sessions[taskId].users) {
        sessions[taskId].users[user].voted = false;
      }
      io.to(taskId).emit('votesUpdate', sessions[taskId].votes, false);
      io.to(taskId).emit('taskInfo', { taskId, taskDescription: sessions[taskId].taskDescription, users: sessions[taskId].users });
    }
  });
});

server.listen(443, () => {
  console.log('Listening on http://localhost:3000');
});
