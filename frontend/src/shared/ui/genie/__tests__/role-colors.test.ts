import { describe, it, expect } from 'vitest'
import { getColorForRole, ROLE_COLORS, DEFAULT_COLOR } from '../role-colors'
import type { CommandRole } from '@shared/constants/command-roles'

describe('role-colors', () => {
  describe('ROLE_COLORS mapping', () => {
    it('should define color for each role', () => {
      const expectedRoles: CommandRole[] = ['llm', 'search', 'transform', 'control', 'utility']

      expectedRoles.forEach(role => {
        expect(ROLE_COLORS[role]).toBeDefined()
        expect(typeof ROLE_COLORS[role]).toBe('string')
      })
    })

    it('should use valid hex color format', () => {
      const hexColorRegex = /^#[0-9a-f]{6}$/i

      Object.values(ROLE_COLORS).forEach(color => {
        expect(color).toMatch(hexColorRegex)
      })
    })

    it('should have unique colors for each role', () => {
      const colors = Object.values(ROLE_COLORS)
      const uniqueColors = new Set(colors)

      expect(uniqueColors.size).toBe(colors.length)
    })

    it('should map llm role to orange', () => {
      expect(ROLE_COLORS.llm).toBe('#ffa726')
    })

    it('should map search role to blue', () => {
      expect(ROLE_COLORS.search).toBe('#42a5f5')
    })

    it('should map transform role to green', () => {
      expect(ROLE_COLORS.transform).toBe('#66bb6a')
    })

    it('should map control role to purple', () => {
      expect(ROLE_COLORS.control).toBe('#ab47bc')
    })

    it('should map utility role to gray', () => {
      expect(ROLE_COLORS.utility).toBe('#9e9e9e')
    })
  })

  describe('DEFAULT_COLOR', () => {
    it('should be defined', () => {
      expect(DEFAULT_COLOR).toBeDefined()
    })

    it('should be valid hex color', () => {
      expect(DEFAULT_COLOR).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('should be gray for unknown commands', () => {
      expect(DEFAULT_COLOR).toBe('#9e9e9e')
    })
  })

  describe('getColorForRole', () => {
    it('should return correct color for each role', () => {
      expect(getColorForRole('llm')).toBe('#ffa726')
      expect(getColorForRole('search')).toBe('#42a5f5')
      expect(getColorForRole('transform')).toBe('#66bb6a')
      expect(getColorForRole('control')).toBe('#ab47bc')
      expect(getColorForRole('utility')).toBe('#9e9e9e')
    })

    it('should return default color for undefined', () => {
      expect(getColorForRole(undefined)).toBe(DEFAULT_COLOR)
    })

    it('should return default color for unknown role', () => {
      expect(getColorForRole('unknown' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('invalid' as CommandRole)).toBe(DEFAULT_COLOR)
    })

    it('should handle null gracefully', () => {
      expect(getColorForRole(null as unknown as CommandRole)).toBe(DEFAULT_COLOR)
    })

    it('should return same result for repeated calls', () => {
      const result1 = getColorForRole('llm')
      const result2 = getColorForRole('llm')
      const result3 = getColorForRole('llm')

      expect(result1).toBe(result2)
      expect(result2).toBe(result3)
      expect(result1).toBe('#ffa726')
    })
  })

  describe('color consistency', () => {
    it('should return colors that contrast with light backgrounds', () => {
      const colors = Object.values(ROLE_COLORS)

      colors.forEach(color => {
        const r = parseInt(color.slice(1, 3), 16)
        const g = parseInt(color.slice(3, 5), 16)
        const b = parseInt(color.slice(5, 7), 16)

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

        expect(luminance).toBeGreaterThan(0.2)
        expect(luminance).toBeLessThan(0.9)
      })
    })

    it('should maintain color across different call patterns', () => {
      const roles: CommandRole[] = ['llm', 'search', 'transform', 'control', 'utility']

      roles.forEach(role => {
        const color1 = getColorForRole(role)
        const color2 = ROLE_COLORS[role]
        expect(color1).toBe(color2)
      })
    })
  })

  describe('integration with command-roles', () => {
    it('should provide colors for all mapped roles', () => {
      const roles: CommandRole[] = ['llm', 'search', 'transform', 'control', 'utility']

      roles.forEach(role => {
        const color = getColorForRole(role)
        expect(color).toBeDefined()
        expect(color).toMatch(/^#[0-9a-f]{6}$/i)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(getColorForRole('' as CommandRole)).toBe(DEFAULT_COLOR)
    })

    it('should handle whitespace', () => {
      expect(getColorForRole(' ' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('  ' as CommandRole)).toBe(DEFAULT_COLOR)
    })

    it('should be case-sensitive', () => {
      expect(getColorForRole('LLM' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('Llm' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('llm')).toBe('#ffa726')
    })

    it('should handle special characters', () => {
      expect(getColorForRole('llm!' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('llm?' as CommandRole)).toBe(DEFAULT_COLOR)
    })

    it('should handle numbers', () => {
      expect(getColorForRole('123' as CommandRole)).toBe(DEFAULT_COLOR)
      expect(getColorForRole('llm123' as CommandRole)).toBe(DEFAULT_COLOR)
    })
  })

  describe('visual consistency', () => {
    it('should use Material Design color palette', () => {
      const materialColors = {
        '#ffa726': 'Orange 400',
        '#42a5f5': 'Blue 400',
        '#66bb6a': 'Green 400',
        '#ab47bc': 'Purple 400',
        '#9e9e9e': 'Grey 400',
      }

      Object.values(ROLE_COLORS).forEach(color => {
        expect(materialColors).toHaveProperty(color)
      })
    })

    it('should maintain distinct hues for easy recognition', () => {
      const llmRGB = { r: 255, g: 167, b: 38 }
      const searchRGB = { r: 66, g: 165, b: 245 }
      const transformRGB = { r: 102, g: 187, b: 106 }
      const controlRGB = { r: 171, g: 71, b: 188 }
      const utilityRGB = { r: 158, g: 158, b: 158 }

      const colors = [llmRGB, searchRGB, transformRGB, controlRGB, utilityRGB]

      for (let i = 0; i < colors.length; i++) {
        for (let j = i + 1; j < colors.length; j++) {
          const colorDist = Math.sqrt(
            Math.pow(colors[i].r - colors[j].r, 2) +
              Math.pow(colors[i].g - colors[j].g, 2) +
              Math.pow(colors[i].b - colors[j].b, 2),
          )

          expect(colorDist).toBeGreaterThan(50)
        }
      }
    })
  })

  describe('integration scenarios', () => {
    it('should support Genie component color rendering', () => {
      const roles: CommandRole[] = ['llm', 'search', 'transform', 'control', 'utility']

      roles.forEach(role => {
        const color = getColorForRole(role)
        expect(color).toBeTruthy()
        expect(color.length).toBe(7)
      })
    })

    it('should support tree node default component', () => {
      const roles: CommandRole[] = ['llm', 'search', 'transform', 'control']

      roles.forEach(role => {
        const color = getColorForRole(role)
        expect(color).not.toBe(DEFAULT_COLOR)
      })
    })

    it('should handle fallback scenarios', () => {
      const invalidInputs = [undefined, null, '', 'invalid']

      invalidInputs.forEach(input => {
        const color = getColorForRole(input as CommandRole)
        expect(color).toBe(DEFAULT_COLOR)
      })
    })
  })
})
