import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@shared/ui/card'
import { Button } from '@shared/ui/button'
import { cn } from '@shared/lib/utils'

const Main = () => {
  const buttonVariants: Parameters<typeof Button>[0]['variant'][] = [
    'default',
    'destructive',
    'accent',
    'outline',
    'secondary',
    'ghost',
    'link',
  ]

  const buttonSizes: Parameters<typeof Button>[0]['size'][] = ['sm', 'default', 'lg', 'icon']

  return (
    <div className="p-8 flex flex-col gap-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
        {[1, 2, 3].map(i => (
          <Card className={cn(i === 1 && 'col-span-2')} key={i}>
            <CardHeader>
              <CardTitle>Card {i}</CardTitle>
              <CardDescription>Description for card {i}</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Some content inside the card. Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
            </CardContent>
            <CardFooter>
              <Button size="sm" variant="default">
                Action
              </Button>
              <Button className="ml-2" size="sm" variant="secondary">
                Secondary
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Buttons Showcase</h2>
        {buttonVariants.map(variant => (
          <div className="mb-6" key={variant}>
            <h3 className="font-medium mb-2">{variant!.charAt(0).toUpperCase() + variant!.slice(1)}</h3>
            <div className="flex gap-4 flex-wrap">
              {buttonSizes.map(size => (
                <Button key={size} size={size} variant={variant}>
                  {size}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Main
