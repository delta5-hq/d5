import { DeltaFiveApiParams, DeltaFiveConfiguration, EventType, LikeStatus, MessageType } from "../_interfaces"
import axios from "axios"
import { EventSourcePolyfill } from "event-source-polyfill"
import qs from "qs"
import { API_ROOT } from "../configuration"

export default class DeltaFiveApi {
  private _config: DeltaFiveConfiguration

  constructor({ deltafiveConfiguration }: DeltaFiveApiParams) {
    this._config = deltafiveConfiguration
  }

  get sourcePattern(): string {
    return this._config.sourcePattern
  }

  public async createApiRequest<T>({
    method,
    route,
    params = {},
    data = {},
  }: {
    method: "GET" | "POST"
    route: string
    params?: { [k: string]: any }
    data?: { [k: string]: any }
  }) {
    const response = await axios<T>({
      method: method,
      url: `${API_ROOT}${this._config.apiVersion}${route}`,
      headers: {
        Authorization: "Bearer " + this._config.token,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      params,
      data,
      paramsSerializer: (params) => {
        return qs.stringify(params, { arrayFormat: "repeat" })
      },
      timeout: 600000,
    })
    return response
  }

  public async setReaction({ requestId, likeStatus }: { requestId: string; likeStatus: LikeStatus }) {
    // TODO: Save reactions
    return new Promise(() => {})
  }
}
