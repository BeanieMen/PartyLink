// components/GoogleIcon.tsx
import React from 'react'
import Svg, { Path } from 'react-native-svg'

const GoogleIcon = ({ size = 22, color = '#4285F4' }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill={color}
      d="M24 9.5c3.4 0 6.1 1.3 8 3.3l5.9-5.9c-3.4-3.2-7.7-5.2-13.9-5.2C12.1 1.7 3.4 10.4 3.4 21.7S12.1 41.7 24 41.7c10.4 0 18.5-7.2 18.5-17.4 0-1.3-.2-2.6-.5-3.8H24v7.5h10.7c-.5 2.7-2.1 5.1-4.5 6.5L24 33.7c-6.6 0-12.1-5.4-12.1-12.1s5.4-12.1 12.1-12.1z"
    />
  </Svg>
)

export default GoogleIcon
