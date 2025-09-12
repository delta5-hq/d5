import createGridFSFileClass from './utils/createGridFSFileClass'

// when creating a thumbnail, make sure you reference the correponding file in the metadata
const Thumbnail = createGridFSFileClass('Thumbnail')

Thumbnail.SIZES = {
  full: 'full',
  small: 'small',
  tiny: 'tiny',
}

export default Thumbnail
