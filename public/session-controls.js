function setSessionActive(active) {
  document.body.classList.toggle('session-active', active);
  if (active) document.getElementById('sessionEndNotice')?.remove();
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

function openDonateDialog() {
  const dialog = document.getElementById('donateDialog');
  const isCreator = document.getElementById('username').value.trim().toUpperCase() === 'PBL';
  document.getElementById('donationBroadcastButton').hidden = !isCreator;
  hideDonationBroadcastForm();
  if (!dialog.open) dialog.showModal();
}

function closeDonateDialog() {
  document.getElementById('donateDialog').close();
}

function showDonationBroadcastForm() {
  document.getElementById('donationBroadcastButton').hidden = true;
  document.getElementById('donationQrSection').hidden = true;
  document.getElementById('donationBroadcastForm').hidden = false;
  document.getElementById('donationThankYou').focus();
}

function hideDonationBroadcastForm() {
  const form = document.getElementById('donationBroadcastForm');
  form.hidden = true;
  form.reset();
  document.getElementById('donationQrSection').hidden = false;
  document.getElementById('donationBroadcastButton').hidden = document.getElementById('username').value.trim().toUpperCase() !== 'PBL';
}

function broadcastDonationThanks(event) {
  event.preventDefault();
  if (!currentTaskId) return;
  if (document.getElementById('username').value.trim().toUpperCase() !== 'PBL') return;
  const message = document.getElementById('donationThankYou').value.trim();
  if (!message) return;
  socket.emit('donationAnnouncement', { taskId: currentTaskId, message });
  closeDonateDialog();
}

function showDonationToast(creator, message) {
  document.getElementById('donationToast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'donationToast';
  toast.className = 'donation-toast';
  toast.setAttribute('role', 'status');
  toast.innerHTML = '<span class="donation-toast-icon" aria-hidden="true"><i class="bi bi-heart-fill"></i></span><div><strong>Kindness at the table</strong><p></p></div><button type="button" aria-label="Dismiss donation announcement">×</button>';
  toast.querySelector('p').textContent = creator + ': ' + message;
  toast.querySelector('button').addEventListener('click', () => toast.remove());
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), 7000);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('donationBroadcastForm').addEventListener('submit', broadcastDonationThanks);
});

function leaveCurrentSession() {
  const button = document.getElementById('newSessionButton');
  button.disabled = true;
  socket.emit('leaveSession', () => {
    resetSessionScreen();
  });
}

function resetSessionScreen() {
    // Reset only after the server has removed this socket from the room.
    ['isHost', 'shareLink', 'taskInfo', 'votesUpdate', 'votesLocked', 'resetAllVotes', 'sessionJoined', 'donationAnnounced'].forEach(event => socket.off(event));
    currentTaskId = null;
    isHost = false;
    currentVotesRevealed = false;
    currentRevealedUsers = null;
    currentAverageVote = null;
    userDeckWasRevealed = false;
    lastVotesUpdateAt = 0;
    shouldAutoScrollToVoting = false;
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
    document.getElementById('newSessionButton').disabled = false;
    document.getElementById('taskId').focus();
}

socket.on('sessionEnded', ({ taskId, host }) => {
  if (currentTaskId !== taskId) return;
  resetSessionScreen();
  document.getElementById('sessionEndNotice')?.remove();
  const notice = document.createElement('div');
  notice.id = 'sessionEndNotice';
  notice.className = 'session-end-notice';
  notice.setAttribute('role', 'status');
  const icon = document.createElement('span');
  icon.className = 'session-end-notice-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = '<i class="bi bi-door-open"></i>';
  const content = document.createElement('div');
  content.className = 'session-end-notice-content';
  const title = document.createElement('strong');
  title.textContent = 'The host has left the table';
  const message = document.createElement('p');
  message.textContent = host + ' left session #' + taskId + ', so this session has ended. Start or join a new session below.';
  content.append(title, message);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'session-end-notice-dismiss';
  dismiss.setAttribute('aria-label', 'Dismiss session notification');
  dismiss.textContent = '×';
  dismiss.addEventListener('click', () => notice.remove());
  notice.append(icon, content, dismiss);
  document.querySelector('.hero-session-form').before(notice);
});
