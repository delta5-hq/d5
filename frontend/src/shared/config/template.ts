export interface TemplateProperties {
  shownName?: string
  imageFit?: 'cover' | 'contain'
}

export interface FormattedTemplate {
  prodId: string
  devId: string
  localhostIds: string[]
  picture: string
  properties?: TemplateProperties
}

export type FormattedTemplateList = FormattedTemplate[]

export const MAX_CARDS = 8
export const MIN_CARD_SIZE = 255

export const MOBILE_MAXIMUM_WIDTH = 1279
export const MOBILE_OFFSET_WIDTH = 170
export const DESKTOP_OFFSET_WIDTH = 400

/**
 * This list is the preferred order for shown templates and for setting pictures. The others will be show at the end.
 *
 * `localhostIds` is a list where devs can add IDs for their localhost-environment
 */
export const FORMATTED_TEMPLATE_LIST: FormattedTemplateList = []
