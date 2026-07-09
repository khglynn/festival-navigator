/** Tailwind is precompiled to assets/tailwind.css (committed) so the deployed
 * site stays build-less. After changing classes in index.html or js/, run:
 *   npm run css
 */
module.exports = {
  content: ['./index.html', './recover.html', './js/**/*.js'],
  theme: { extend: {} },
  plugins: [],
};
