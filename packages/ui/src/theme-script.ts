/**
 * Inline script that runs before React hydration to prevent theme flash.
 * Embed in layout via: <script dangerouslySetInnerHTML={{ __html: themeScript }} />
 */
export const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;
