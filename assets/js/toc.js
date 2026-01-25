// Table of contents scroll spy
window.addEventListener('DOMContentLoaded', function() {
  const toc = document.querySelector('.toc');
  if (!toc) {
    console.log('No TOC found');
    return;
  }

  const tocLinks = toc.querySelectorAll('a[href^="#"]');
  const headings = document.querySelectorAll('.docs-content h2[id], .docs-content h3[id]');

  console.log('TOC links:', tocLinks.length);
  console.log('Headings:', headings.length);

  if (tocLinks.length === 0 || headings.length === 0) return;

  function setActiveLink() {
    const scrollPos = window.scrollY + 100;

    let currentId = null;
    headings.forEach(heading => {
      if (heading.offsetTop <= scrollPos) {
        currentId = heading.id;
      }
    });

    tocLinks.forEach(link => {
      link.classList.remove('active');
      if (currentId && link.hash === '#' + currentId) {
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', setActiveLink);
  setActiveLink();
});
