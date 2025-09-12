import { API_ROOT } from "../../configuration"
import styles from "./styles.module.css"
import DeltaFiveLogoFull from "/src/_images/chat/footer/delta5-logo.png"

export default function Footer() {
  return (
    <div className={styles.footer}>
      <a className={styles.footerContent} href={API_ROOT} target="_blank" rel="noopener noreferrer">
        Powered by
        <img
          src={DeltaFiveLogoFull}
          alt="DeltaFive"
          style={{ objectFit: "contain", marginLeft: "7px" }}
          height={24}
        />
      </a>
    </div>
  )
}
