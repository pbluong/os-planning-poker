function setSessionActive(active) {
  ['startTaskButton', 'joinTaskButton'].forEach(id => {
    document.getElementById(id).hidden = active;
  });
  document.getElementById('newSessionButton').hidden = !active;
  document.getElementById('activeSessionSummary').hidden = !active;
  ['username', 'taskId', 'taskDescription'].forEach(id => {
    document.getElementById(id).disabled = active;
    document.getElementById(id).hidden = active;
  });
}

function leaveCurrentSession() {
  const button = document.getElementById('newSessionButton');
  button.disabled = true;
  socket.emit('leaveSession', () => {
    // Reset only after the server has removed this socket from the room.
    ['isHost', 'shareLink', 'taskInfo', 'votesUpdate', 'votesLocked', 'resetAllVotes', 'sessionJoined'].forEach(event => socket.off(event));
    currentTaskId = null;
    isHost = false;
    currentVotesRevealed = false;
    currentRevealedUsers = null;
    currentAverageVote = null;
    userDeckWasRevealed = false;
    lastVotesUpdateAt = 0;
    closeAvatarPreview();
    document.querySelectorAll('[data-bs-toggle="popover"]').forEach(el => bootstrap.Popover.getInstance(el)?.dispose());
    resetCharts();
    resetEstimationForm();
    resetVoteButtons();
    updateVoteControlsLocked(false);
    ['hostControls', 'voting', 'downloadPdfBtn', 'indicator'].forEach(id => {
      document.getElementById(id).style.display = 'none';
    });
    ['userAvatars', 'userList', 'results', 'indicator', 'taskDetails', 'sharedLinkText'].forEach(id => {
      document.getElementById(id).replaceChildren();
    });
    document.getElementById('taskDetails').hidden = true;
    document.getElementById('shareLink').hidden = true;
    document.getElementById('shareLink').style.display = '';
    document.getElementById('taskId').value = '';
    document.getElementById('taskDescription').value = '';
    const url = new URL(window.location.href);
    url.searchParams.delete('taskId');
    history.replaceState(null, '', url);
    setSessionActive(false);
    button.disabled = false;
    document.getElementById('taskId').focus();
  });
}
