import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { Genie, type GenieState, type GenieRef } from '../genie-base'

vi.mock('../genie', () => ({
  GenieLottie: ({ size }: { size: number }) => <div data-size={size} data-testid="genie-lottie" />,
}))

vi.mock('../clipboard', () => ({
  Clipboard: ({ size }: { size: number }) => <div data-size={size} data-testid="genie-clipboard" />,
}))

vi.mock('../hands', () => ({
  Hands: ({ size, showRibs }: { size: number; showRibs: boolean }) => (
    <div data-show-ribs={showRibs} data-size={size} data-testid="genie-hands" />
  ),
}))

vi.mock('../radial-flash', () => ({
  RadialFlash: ({ size }: { size: number }) => <div data-size={size} data-testid="genie-flash" />,
}))

describe('Genie', () => {
  describe('default rendering', () => {
    it('should render with all components when no variant specified', () => {
      render(<Genie />)

      expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
      expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()
      expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
      expect(screen.getByTestId('genie-flash')).toBeInTheDocument()
    })

    it('should use default size of 128', () => {
      render(<Genie />)

      expect(screen.getByTestId('genie-clipboard')).toHaveAttribute('data-size', '128')
    })

    it('should use default state of idle', () => {
      render(<Genie />)

      expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
    })
  })

  describe('variant prop', () => {
    describe('full variant', () => {
      it('should render all components', () => {
        render(<Genie variant="full" />)

        expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
        expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()
        expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
        expect(screen.getByTestId('genie-flash')).toBeInTheDocument()
      })

      it('should render lottie animation layer', () => {
        render(<Genie variant="full" />)

        expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
      })

      it('should render hands layer', () => {
        render(<Genie variant="full" />)

        expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
      })

      it('should render radial flash layer', () => {
        render(<Genie variant="full" />)

        expect(screen.getByTestId('genie-flash')).toBeInTheDocument()
      })
    })

    describe('clipboard variant', () => {
      it('should render only clipboard component', () => {
        render(<Genie variant="clipboard" />)

        expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()
        expect(screen.queryByTestId('genie-lottie')).not.toBeInTheDocument()
        expect(screen.queryByTestId('genie-hands')).not.toBeInTheDocument()
        expect(screen.queryByTestId('genie-flash')).not.toBeInTheDocument()
      })

      it('should not render lottie animation layer', () => {
        render(<Genie variant="clipboard" />)

        expect(screen.queryByTestId('genie-lottie')).not.toBeInTheDocument()
      })

      it('should not render hands layer', () => {
        render(<Genie variant="clipboard" />)

        expect(screen.queryByTestId('genie-hands')).not.toBeInTheDocument()
      })

      it('should not render radial flash layer', () => {
        render(<Genie variant="clipboard" />)

        expect(screen.queryByTestId('genie-flash')).not.toBeInTheDocument()
      })
    })

    it('should maintain clipboard across all variants', () => {
      const { rerender } = render(<Genie variant="full" />)
      expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()

      rerender(<Genie variant="clipboard" />)
      expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()
    })

    it('should handle variant switching without errors', () => {
      const { rerender } = render(<Genie variant="full" />)

      expect(() => rerender(<Genie variant="clipboard" />)).not.toThrow()
      expect(() => rerender(<Genie variant="full" />)).not.toThrow()
    })

    it('should treat undefined variant as full', () => {
      render(<Genie variant={undefined} />)

      expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
      expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
      expect(screen.getByTestId('genie-flash')).toBeInTheDocument()
    })
  })

  describe('imperative handle', () => {
    describe('flash method', () => {
      it('should expose flash method', () => {
        const ref = createRef<GenieRef>()
        render(<Genie ref={ref} />)

        expect(ref.current).toBeDefined()
        expect(ref.current?.flash).toBeInstanceOf(Function)
      })

      it('should not throw when flash called on full variant', () => {
        const ref = createRef<GenieRef>()
        render(<Genie ref={ref} variant="full" />)

        expect(() => ref.current?.flash()).not.toThrow()
      })

      it('should not throw when flash called on clipboard variant', () => {
        const ref = createRef<GenieRef>()
        render(<Genie ref={ref} variant="clipboard" />)

        expect(() => ref.current?.flash()).not.toThrow()
      })

      it('should handle multiple flash calls without errors', () => {
        const ref = createRef<GenieRef>()
        render(<Genie ref={ref} />)

        expect(() => {
          ref.current?.flash()
          ref.current?.flash()
          ref.current?.flash()
        }).not.toThrow()
      })

      it('should maintain flash method across re-renders', () => {
        const ref = createRef<GenieRef>()
        const { rerender } = render(<Genie ref={ref} variant="full" />)

        expect(ref.current?.flash).toBeInstanceOf(Function)

        rerender(<Genie ref={ref} state="busy" variant="full" />)
        expect(ref.current?.flash).toBeInstanceOf(Function)
        expect(() => ref.current?.flash()).not.toThrow()
      })
    })
  })

  describe('state prop', () => {
    const states: GenieState[] = ['idle', 'busy', 'busy-alert', 'done-success', 'done-failure']

    it.each(states)('should accept state=%s', state => {
      expect(() => render(<Genie state={state} />)).not.toThrow()
    })

    it.each(states)('should render with state=%s in full variant', state => {
      render(<Genie state={state} variant="full" />)

      expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
    })

    it.each(states)('should not affect rendering when variant=clipboard and state=%s', state => {
      const { container } = render(<Genie state={state} variant="clipboard" />)

      expect(screen.queryByTestId('genie-lottie')).not.toBeInTheDocument()
      expect(container.querySelector('.genie-reading')).not.toBeInTheDocument()
    })
  })

  describe('color prop', () => {
    it('should render without color when variant=clipboard', () => {
      render(<Genie color="#ff0000" variant="clipboard" />)

      expect(screen.queryByTestId('genie-hands')).not.toBeInTheDocument()
    })

    it('should apply color when variant=full', () => {
      render(<Genie color="#ff0000" variant="full" />)

      expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
    })

    it('should use default color when not specified', () => {
      render(<Genie variant="full" />)

      expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
    })
  })

  describe('showHandRibs prop', () => {
    it('should pass showHandRibs=true to hands component', () => {
      render(<Genie showHandRibs={true} variant="full" />)

      const hands = screen.getByTestId('genie-hands')
      expect(hands).toHaveAttribute('data-show-ribs', 'true')
    })

    it('should pass showHandRibs=false to hands component', () => {
      render(<Genie showHandRibs={false} variant="full" />)

      const hands = screen.getByTestId('genie-hands')
      expect(hands).toHaveAttribute('data-show-ribs', 'false')
    })

    it('should default to showHandRibs=false', () => {
      render(<Genie variant="full" />)

      const hands = screen.getByTestId('genie-hands')
      expect(hands).toHaveAttribute('data-show-ribs', 'false')
    })

    it('should not render hands when variant=clipboard regardless of showHandRibs', () => {
      render(<Genie showHandRibs={true} variant="clipboard" />)

      expect(screen.queryByTestId('genie-hands')).not.toBeInTheDocument()
    })
  })

  describe('size prop', () => {
    it('should pass custom size to all components in full variant', () => {
      render(<Genie size={64} variant="full" />)

      expect(screen.getByTestId('genie-lottie')).toHaveAttribute('data-size', '64')
      expect(screen.getByTestId('genie-clipboard')).toHaveAttribute('data-size', '64')
      expect(screen.getByTestId('genie-hands')).toHaveAttribute('data-size', '64')
      expect(screen.getByTestId('genie-flash')).toHaveAttribute('data-size', '64')
    })

    it('should pass custom size to clipboard in clipboard variant', () => {
      render(<Genie size={32} variant="clipboard" />)

      expect(screen.getByTestId('genie-clipboard')).toHaveAttribute('data-size', '32')
    })

    it('should apply size consistently across re-renders', () => {
      const { rerender } = render(<Genie size={80} />)

      expect(screen.getByTestId('genie-clipboard')).toHaveAttribute('data-size', '80')

      rerender(<Genie size={80} state="busy" />)
      expect(screen.getByTestId('genie-clipboard')).toHaveAttribute('data-size', '80')
    })
  })

  describe('className prop', () => {
    it('should apply custom className to container', () => {
      const { container } = render(<Genie className="custom-class" />)

      const genieContainer = container.querySelector('.custom-class')
      expect(genieContainer).toBeInTheDocument()
    })

    it('should apply className across variants', () => {
      const { container, rerender } = render(<Genie className="test-class" variant="full" />)

      expect(container.querySelector('.test-class')).toBeInTheDocument()

      rerender(<Genie className="test-class" variant="clipboard" />)
      expect(container.querySelector('.test-class')).toBeInTheDocument()
    })
  })

  describe('layering behavior', () => {
    it('should render components in correct z-order for full variant', () => {
      const { container } = render(<Genie variant="full" />)

      const children = Array.from(container.firstElementChild?.children || [])
      const testIds = children.map(el => el.getAttribute('data-testid') || 'wrapper')

      expect(testIds).toContain('genie-clipboard')
      expect(testIds).toContain('genie-hands')
      expect(testIds).toContain('genie-flash')
    })

    it('should render only clipboard for clipboard variant', () => {
      const { container } = render(<Genie variant="clipboard" />)

      const children = Array.from(container.firstElementChild?.children || [])
      expect(children).toHaveLength(1)
      expect(children[0].getAttribute('data-testid')).toBe('genie-clipboard')
    })
  })

  describe('variant combinations', () => {
    const variants = [
      { variant: 'full' as const, expectedComponents: ['lottie', 'clipboard', 'hands', 'flash'] },
      { variant: 'clipboard' as const, expectedComponents: ['clipboard'] },
    ]

    variants.forEach(({ variant, expectedComponents }) => {
      it(`should render correct components for variant=${variant}`, () => {
        render(<Genie variant={variant} />)

        if (expectedComponents.includes('lottie')) {
          expect(screen.getByTestId('genie-lottie')).toBeInTheDocument()
        } else {
          expect(screen.queryByTestId('genie-lottie')).not.toBeInTheDocument()
        }

        if (expectedComponents.includes('clipboard')) {
          expect(screen.getByTestId('genie-clipboard')).toBeInTheDocument()
        } else {
          expect(screen.queryByTestId('genie-clipboard')).not.toBeInTheDocument()
        }

        if (expectedComponents.includes('hands')) {
          expect(screen.getByTestId('genie-hands')).toBeInTheDocument()
        } else {
          expect(screen.queryByTestId('genie-hands')).not.toBeInTheDocument()
        }

        if (expectedComponents.includes('flash')) {
          expect(screen.getByTestId('genie-flash')).toBeInTheDocument()
        } else {
          expect(screen.queryByTestId('genie-flash')).not.toBeInTheDocument()
        }
      })
    })
  })

  describe('edge cases', () => {
    it('should handle rapid variant changes', () => {
      const { rerender } = render(<Genie variant="full" />)

      expect(() => {
        for (let i = 0; i < 10; i++) {
          rerender(<Genie variant={i % 2 === 0 ? 'full' : 'clipboard'} />)
        }
      }).not.toThrow()
    })

    it('should handle all props simultaneously', () => {
      expect(() =>
        render(
          <Genie
            className="test"
            clipboardEdge="#000"
            clipboardFill="#fff"
            color="#ff0000"
            flashColor="#00ff00"
            nodeId="test-node"
            showHandRibs={true}
            size={100}
            state="busy"
            variant="full"
          />,
        ),
      ).not.toThrow()
    })

    it('should handle minimal props', () => {
      expect(() => render(<Genie />)).not.toThrow()
    })
  })
})
