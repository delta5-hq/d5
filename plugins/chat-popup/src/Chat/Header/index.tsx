import { Configuration } from "../../_interfaces"
import localizations from "../../_lib/localization"
import styles from "./styles.module.css"
import CloseIcon from "/src/_images/chat/header/close-icon.svg?react"
import Delta5Logo from "/src/_images/chat/header/delta5-logo.png"
import RefreshIcon from "/src/_images/chat/header/refresh-icon.svg?react"

export default function Header({
  configuration,
  onClearButtonClick,
  isMobile,
  onCollapseButtonClick,
}: {
  configuration: Configuration
  onClearButtonClick: () => void
  isMobile: boolean
  onCollapseButtonClick: () => void
}) {
  return (
    <div className={styles.header}>
      <div className={styles.heading}>
        {!configuration.whitelabel && (
          <img src={Delta5Logo} alt="Delta5 logo" height={36} width={36} style={{ objectFit: "contain" }} />
        )}
        {configuration.windowHeading}
      </div>
      <div className={styles.buttons}>
        <button
          className="deltafive-small-btn"
          onClick={() => onClearButtonClick()}
          aria-label={localizations[configuration.lang].clear}
        >
          <RefreshIcon height={18} width={18} />
          {!isMobile && (
            <div className={`deltafive-tooltip ${styles.headerTooltip}`}>{localizations[configuration.lang].clear}</div>
          )}
        </button>
        {isMobile && (
          <button
            className="deltafive-small-btn"
            onClick={() => onCollapseButtonClick()}
            aria-label={localizations[configuration.lang].collapse}
          >
            <CloseIcon height={18} width={18} />
            {/* <div className={`deltafive-tooltip ${styles.headerTooltip}`}>{localizations[configuration.lang].collapse}</div> */}
          </button>
        )}
      </div>
    </div>
  )
}
