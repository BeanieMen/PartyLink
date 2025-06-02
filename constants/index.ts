const tintColorLight = '#2f95dc'
const tintColorDark = '#fff'

export const pink500 = '#EC4899'
export const pink400 = '#F472B6'
export const pink600 = '#DB2777'
export const pink300 = '#FF80AB'
export const pink700 = '#C2185B'
export const white = '#FFFFFF'
export const black = '#000000'

export const gray100 = '#F3F4F6'
export const gray200 = '#E5E7EB'
export const gray300 = '#D1D5DB'
export const gray400 = '#9CA3AF'
export const gray500 = '#9E9E9E'
export const gray600 = '#4B5563'
export const gray700 = '#374151'
export const gray800 = '#1F2937'
export const textGray = '#A0A0A0'

export const yellow400 = '#FACC15'

export const blue300 = '#64B5F6'
export const blue400 = '#60A5FA'
export const blue500 = '#3B82F6'

export const teal500 = '#14b8a6'
export const teal600 = '#0d9488'

export const green400 = '#4ade80'
export const green500 = '#22C55E'

export const red = '#FF0000'
export const red100 = '#FEE2E2'
export const red300 = '#FCA5A5'
export const red400 = '#f87171'
export const red500 = '#DC3545'
export const red700 = '#B91C1C'
export const red900 = 'rgba(127, 29, 29, 0.3)'

export const orange400 = '#FF9800'

export const primary = '#7c3aed'
export const accent = '#be185d'
export const secondaryText = '#b0b0b0'
export const disabled = '#555'

export const primaryBg = '#1a0b2e'
export const secondaryBg = '#2d1b4e'
export const tertiaryBg = '#3A1F5D'
export const darkerBg = '#58216d'

export const inputBg = '#3B3E45'
export const cardBg = '#3A1F5D'

export const secondaryBgTransparent = 'rgba(45, 48, 53, 0.85)'

export const textGray300 = '#D1D5DB'
export const textGray400 = '#9CA3AF'
export const textBlack = '#000000'

export const whiteA05 = 'rgba(255,255,255,0.05)'
export const whiteA10 = 'rgba(255,255,255,0.1)'
export const whiteA50 = 'rgba(255,255,255,0.5)'
export const whiteA75 = 'rgba(255,255,255,0.75)'

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,

    primary: primary,
    primaryBg: white,
    secondaryBg: gray100,
    cardBg: white,
    gray100,
    gray200,
    gray300,
    gray400,
    gray500,
    gray600,
    gray700,
    gray800,

    whiteA05,
    whiteA10,
    whiteA50,
    whiteA75,
  },
  dark: {
    text: white,
    background: primaryBg,
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,

    pink500,
    pink400,
    pink600,
    pink300,
    pink700,

    white,
    black,

    whiteA05,
    whiteA10,
    whiteA50,
    whiteA75,

    gray100,
    gray200,
    gray300,
    gray400,
    gray500,
    gray600,
    gray700,
    gray800,
    textGray,

    yellow400,

    blue300,
    blue400,
    blue500,

    teal500,
    teal600,

    green400,
    green500,

    red,
    red100,
    red300,
    red400,
    red500,
    red700,
    red900,

    primary,
    accent,
    secondaryText,
    disabled,

    primaryBg,
    secondaryBg,
    tertiaryBg,
    darkerBg,
    inputBg,
    cardBg,
    secondaryBgTransparent,
    orange400,
    textGray300,
    textGray400,
    textBlack,
  },
}

// export const API_BASE_URL = 'http://140.238.160.248:3000'
export const API_BASE_URL = 'http://192.168.1.6:3000'
