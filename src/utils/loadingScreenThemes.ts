export type LoadingColorScheme = 'green' | 'red' | 'blue' | 'purple';

export type LoadingScreenTheme = {
  background: string;
  vignette: string;
  rune: string;
  title: string;
  titleGlow: string;
  subtitle: string;
  subtitleGlow: string;
  ringOuter: string;
  ringInner: string;
  sigilCore: string;
  sigilGlow: string;
  marker: string;
  progressTrack: string;
  progressFill: string;
  progressGlow: string;
  label: string;
  tipsBorder: string;
  tipsBackground: string;
  tipsHeader: string;
  tipsCounter: string;
  tipsBody: string;
  dot: string;
};

const THEMES: Record<LoadingColorScheme, LoadingScreenTheme> = {
  green: {
    background: 'radial-gradient(ellipse at center, #0a1a0a 0%, #050d05 50%, #000000 100%)',
    vignette: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(0,255,80,0.03) 60%, transparent 100%)',
    rune: 'rgba(74,222,128,0.2)',
    title: '#4ade80',
    titleGlow: '0 0 30px rgba(74,222,128,0.6), 0 0 60px rgba(74,222,128,0.2)',
    subtitle: 'rgba(74,222,128,0.45)',
    subtitleGlow: '0 0 10px rgba(74,222,128,0.3)',
    ringOuter: 'rgba(74,222,128,0.3)',
    ringInner: 'rgba(74,222,128,0.2)',
    sigilCore: 'rgba(74,222,128,0.4)',
    sigilGlow: '0 0 20px rgba(74,222,128,0.6), 0 0 40px rgba(74,222,128,0.2)',
    marker: 'rgba(74,222,128,0.6)',
    progressTrack: 'rgba(74,222,128,0.15)',
    progressFill: 'linear-gradient(to right, #15803d, #4ade80, #bbf7d0)',
    progressGlow: '0 0 8px rgba(74,222,128,0.7)',
    label: 'rgba(74,222,128,0.6)',
    tipsBorder: 'rgba(74,222,128,0.2)',
    tipsBackground: 'rgba(74,222,128,0.04)',
    tipsHeader: 'rgba(74,222,128,0.45)',
    tipsCounter: 'rgba(74,222,128,0.3)',
    tipsBody: 'rgba(134,239,172,0.9)',
    dot: 'rgba(74,222,128,0.4)',
  },
  red: {
    background: 'radial-gradient(ellipse at center, #1a0a0a 0%, #0d0505 50%, #000000 100%)',
    vignette: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(255,50,50,0.03) 60%, transparent 100%)',
    rune: 'rgba(248,113,113,0.2)',
    title: '#f87171',
    titleGlow: '0 0 30px rgba(248,113,113,0.6), 0 0 60px rgba(248,113,113,0.2)',
    subtitle: 'rgba(248,113,113,0.45)',
    subtitleGlow: '0 0 10px rgba(248,113,113,0.3)',
    ringOuter: 'rgba(248,113,113,0.3)',
    ringInner: 'rgba(248,113,113,0.2)',
    sigilCore: 'rgba(248,113,113,0.4)',
    sigilGlow: '0 0 20px rgba(248,113,113,0.6), 0 0 40px rgba(248,113,113,0.2)',
    marker: 'rgba(248,113,113,0.6)',
    progressTrack: 'rgba(248,113,113,0.15)',
    progressFill: 'linear-gradient(to right, #991b1b, #f87171, #fecaca)',
    progressGlow: '0 0 8px rgba(248,113,113,0.7)',
    label: 'rgba(248,113,113,0.6)',
    tipsBorder: 'rgba(248,113,113,0.2)',
    tipsBackground: 'rgba(248,113,113,0.04)',
    tipsHeader: 'rgba(248,113,113,0.45)',
    tipsCounter: 'rgba(248,113,113,0.3)',
    tipsBody: 'rgba(252,165,165,0.9)',
    dot: 'rgba(248,113,113,0.4)',
  },
  blue: {
    background: 'radial-gradient(ellipse at center, #0a101a 0%, #050810 50%, #000000 100%)',
    vignette: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(50,100,255,0.03) 60%, transparent 100%)',
    rune: 'rgba(96,165,250,0.2)',
    title: '#60a5fa',
    titleGlow: '0 0 30px rgba(96,165,250,0.6), 0 0 60px rgba(96,165,250,0.2)',
    subtitle: 'rgba(96,165,250,0.45)',
    subtitleGlow: '0 0 10px rgba(96,165,250,0.3)',
    ringOuter: 'rgba(96,165,250,0.3)',
    ringInner: 'rgba(96,165,250,0.2)',
    sigilCore: 'rgba(96,165,250,0.4)',
    sigilGlow: '0 0 20px rgba(96,165,250,0.6), 0 0 40px rgba(96,165,250,0.2)',
    marker: 'rgba(96,165,250,0.6)',
    progressTrack: 'rgba(96,165,250,0.15)',
    progressFill: 'linear-gradient(to right, #1d4ed8, #60a5fa, #bfdbfe)',
    progressGlow: '0 0 8px rgba(96,165,250,0.7)',
    label: 'rgba(96,165,250,0.6)',
    tipsBorder: 'rgba(96,165,250,0.2)',
    tipsBackground: 'rgba(96,165,250,0.04)',
    tipsHeader: 'rgba(96,165,250,0.45)',
    tipsCounter: 'rgba(96,165,250,0.3)',
    tipsBody: 'rgba(147,197,253,0.9)',
    dot: 'rgba(96,165,250,0.4)',
  },
  purple: {
    background: 'radial-gradient(ellipse at center, #100a1a 0%, #080510 50%, #000000 100%)',
    vignette: 'radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, rgba(140,50,255,0.03) 60%, transparent 100%)',
    rune: 'rgba(167,139,250,0.2)',
    title: '#a78bfa',
    titleGlow: '0 0 30px rgba(167,139,250,0.6), 0 0 60px rgba(167,139,250,0.2)',
    subtitle: 'rgba(167,139,250,0.45)',
    subtitleGlow: '0 0 10px rgba(167,139,250,0.3)',
    ringOuter: 'rgba(167,139,250,0.3)',
    ringInner: 'rgba(167,139,250,0.2)',
    sigilCore: 'rgba(167,139,250,0.4)',
    sigilGlow: '0 0 20px rgba(167,139,250,0.6), 0 0 40px rgba(167,139,250,0.2)',
    marker: 'rgba(167,139,250,0.6)',
    progressTrack: 'rgba(167,139,250,0.15)',
    progressFill: 'linear-gradient(to right, #6d28d9, #a78bfa, #ddd6fe)',
    progressGlow: '0 0 8px rgba(167,139,250,0.7)',
    label: 'rgba(167,139,250,0.6)',
    tipsBorder: 'rgba(167,139,250,0.2)',
    tipsBackground: 'rgba(167,139,250,0.04)',
    tipsHeader: 'rgba(167,139,250,0.45)',
    tipsCounter: 'rgba(167,139,250,0.3)',
    tipsBody: 'rgba(196,181,253,0.9)',
    dot: 'rgba(167,139,250,0.4)',
  },
};

export const LOADING_COLOR_SCHEMES: LoadingColorScheme[] = ['green', 'red', 'blue', 'purple'];
export const DEFAULT_LOADING_COLOR_SCHEME: LoadingColorScheme = 'green';

export function getLoadingScreenTheme(scheme: LoadingColorScheme): LoadingScreenTheme {
  return THEMES[scheme];
}

export function pickRandomLoadingColorScheme(): LoadingColorScheme {
  return LOADING_COLOR_SCHEMES[Math.floor(Math.random() * LOADING_COLOR_SCHEMES.length)]!;
}
