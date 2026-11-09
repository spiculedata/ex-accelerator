import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Landing from './Landing.vue';

// `layout: landing` in a page's front matter renders this component inside the default theme
// (navigation, search and footer stay). Every other page uses the default theme untouched.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('landing', Landing);
  }
} satisfies Theme;
