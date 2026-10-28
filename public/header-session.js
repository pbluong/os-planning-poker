(() => {
  const byId = id => document.getElementById(id);
  const update = () => {
    const cards = [...byId('userAvatars').querySelectorAll('.user-card')];
    const ready = cards.filter(card => card.querySelector('.is-ready')).length;
    const revealed = cards.some(card => card.classList.contains('is-revealed'));
    byId('heroSessionStatus').textContent = cards.length ? 'Session ready' : 'Start or join a session';
    byId('heroSessionStatus').classList.toggle('is-ready', cards.length > 0);
    byId('heroParticipantCount').textContent = cards.length
      ? `${cards.length} participant${cards.length === 1 ? '' : 's'} at the table`
      : 'No participants yet';
    const avatars = byId('heroParticipantAvatars');
    avatars.replaceChildren();
    cards.slice(0, 3).forEach(card => {
      const img = card.querySelector('.user-card-front img').cloneNode();
      img.removeAttribute('class');
      img.alt = '';
      avatars.appendChild(img);
    });
    if (cards.length > 3) {
      const extra = document.createElement('span');
      extra.textContent = `+${cards.length - 3}`;
      avatars.appendChild(extra);
    }
    const task = byId('taskDetails').textContent.match(/^Task: (\S+)/);
    const active = !byId('newSessionButton').hidden;
    byId('taskDetails').hidden = active || !task;
    const sessionId = task ? task[1] : cards.length ? byId('taskId').value : '';
    byId('heroSessionNumber').textContent = sessionId ? `Session #${sessionId}` : 'No active session';
    byId('shareLink').hidden = !byId('sharedLinkText').textContent.trim();
    const status = byId('heroVotingStatus');
    status.textContent = !cards.length ? 'Waiting for a session' : revealed ? 'Votes revealed' : ready === cards.length ? 'All votes are in' : 'Waiting for votes';
    status.classList.toggle('is-complete', cards.length > 0 && (revealed || ready === cards.length));
    byId('sessionIdentity').textContent = byId('username').value.toUpperCase();
    const host = active && isHost === true;
    byId('sessionRole').textContent = host ? 'Host' : 'Participant';
    byId('sessionProgress').max = Math.max(1, cards.length);
    byId('sessionProgress').value = ready;
    const complete = active && cards.length > 0 && ready === cards.length;
    byId('roundReadiness').classList.toggle('is-complete', complete || revealed);
    byId('roundReadinessIcon').textContent = complete || revealed ? '✓' : '○';
    byId('roundReadinessTitle').textContent = !active ? 'Ready when you are' : revealed ? 'Time to discuss' : complete ? 'Ready to reveal' : 'Waiting for the team';
    byId('roundReadinessText').textContent = !active ? 'Start or join a session to begin.' : revealed ? 'Compare the results and share your reasoning.' : complete ? `All ${cards.length} participants have submitted a vote.` : `${ready} of ${cards.length} votes submitted. Take your time.`;
    byId('roundReadinessBadge').textContent = !active ? 'Next up' : revealed ? 'Discuss' : complete ? 'Complete' : 'Voting';
  };
  new MutationObserver(update).observe(byId('userAvatars'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  const observer = new MutationObserver(update);
  [byId('taskDetails'), byId('sharedLinkText')].forEach(el => observer.observe(el, { childList: true, subtree: true, characterData: true }));
  new MutationObserver(update).observe(byId('hostControls'), { attributes: true, attributeFilter: ['style'] });
  new MutationObserver(update).observe(byId('newSessionButton'), { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('session-role-changed', update);
  update();
})();
