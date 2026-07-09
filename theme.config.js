/** @type {const} */
// OneVox / OneAI brand palette. The app is dark-first, so light and dark
// share the same values to keep the identity consistent across schemes.
const themeColors = {
  primary: { light: '#34D8A0', dark: '#34D8A0' }, // green accent (start of gradient)
  secondary: { light: '#3AAEE6', dark: '#3AAEE6' }, // cyan accent (end of gradient)
  background: { light: '#0A1628', dark: '#0A1628' }, // deep navy (almost black)
  surface: { light: '#101F38', dark: '#101F38' }, // cards / inputs
  surfaceElevated: { light: '#16263F', dark: '#16263F' }, // highlighted cards
  foreground: { light: '#FFFFFF', dark: '#FFFFFF' }, // primary text
  muted: { light: '#8A9BB5', dark: '#8A9BB5' }, // secondary text
  border: { light: '#22354F', dark: '#22354F' }, // borders / dividers
  success: { light: '#34D399', dark: '#34D399' }, // positive (Sim)
  warning: { light: '#FBBF24', dark: '#FBBF24' },
  error: { light: '#F87171', dark: '#F87171' }, // negative (Não)
};

// Brand gradient (green -> cyan), reused by buttons, borders and accents.
const brandGradient = ['#5DE89B', '#34D8A0', '#3AAEE6'];

// Tipografia: Space Grotesk nos titulos/marca, Inter no texto e UI.
const DISPLAY_FONT = 'Space Grotesk';
const BODY_FONT = 'Inter';

module.exports = { themeColors, brandGradient, DISPLAY_FONT, BODY_FONT };
