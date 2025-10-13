import { version } from './../../version'
import ClickToCopy from './click-to-copy'

const Version = () => (
  <div className="flex justify-center items-center gap-2 text-sm">
    <p>body: </p>
    <ClickToCopy text={version} />
  </div>
)

export { Version }
