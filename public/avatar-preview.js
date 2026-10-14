(() => {
  const hover = document.createElement('div');
  hover.className = 'avatar-preview-hover';
  hover.hidden = true;
  hover.setAttribute('aria-hidden', 'true');
  const hoverImage = document.createElement('img');
  hover.appendChild(hoverImage);
  document.body.appendChild(hover);

  const dialog = document.createElement('dialog');
  dialog.className = 'avatar-preview-dialog';
  dialog.setAttribute('aria-label', 'Avatar preview');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'avatar-preview-close';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Close avatar preview');
  const image = document.createElement('img');
  const name = document.createElement('p');
  dialog.append(close, image, name);
  document.body.appendChild(dialog);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });

  const hide = () => { hover.hidden = true; };
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
  });
  new MutationObserver(hide).observe(document.getElementById('userAvatars'), { childList: true });

  window.enableAvatarPreview = (frame, userKey) => {
    frame.tabIndex = 0;
    frame.setAttribute('role', 'button');
    frame.setAttribute('aria-label', `View ${userKey}'s avatar`);
    frame.setAttribute('aria-haspopup', 'dialog');
    const showHover = () => {
      if (dialog.open) return;
      hoverImage.src = frame.querySelector('img').src;
      hoverImage.alt = `${userKey}'s avatar`;
      hover.hidden = false;
      const rect = frame.getBoundingClientRect();
      const width = hover.offsetWidth;
      const height = hover.offsetHeight;
      hover.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8))}px`;
      const top = rect.top - height - 8;
      hover.style.top = `${Math.max(8, Math.min(top >= 8 ? top : rect.bottom + 8, window.innerHeight - height - 8))}px`;
    };
    frame.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') showHover();
    });
    frame.addEventListener('pointerleave', hide);
    frame.addEventListener('focus', showHover);
    frame.addEventListener('blur', hide);
    const open = event => {
      event.stopPropagation();
      hide();
      image.src = frame.querySelector('img').src;
      image.alt = `${userKey}'s avatar`;
      name.textContent = userKey;
      if (!dialog.open) dialog.showModal();
    };
    frame.addEventListener('click', open);
    frame.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(event);
      }
    });
  };
})();
