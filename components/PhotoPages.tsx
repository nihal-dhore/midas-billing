import { SitePhoto } from "@/lib/photos";
import styles from "./PhotoPages.module.css";

interface Props {
  photos: SitePhoto[];
}

// Site-photo pages printed after the invoice: a bordered box per page split
// into two halves, each with a photo and its Location / Size lines.
//
// Every size here is a fixed mm value and the layout is plain blocks (no
// flex/grid/percentage heights): Safari's print engine, used by the iPad
// "Download PDF" flow, mis-sizes flex and percentage heights in paged media
// (see InvoicePreview). The box fills the page like the client's sample and
// is capped to the printable height in print, so Letter paper or the iPad's
// own header/footer band shrink it instead of adding pages.
export default function PhotoPages({ photos }: Props) {
  if (photos.length === 0) return null;

  const pages: SitePhoto[][] = [];
  for (let i = 0; i < photos.length; i += 2) pages.push(photos.slice(i, i + 2));

  return (
    <>
      {pages.map((pair, pageIdx) => (
        <div key={pair[0].id} className={`${styles.sheet} photo-sheet`}>
          <div className={styles.box}>
            {pair.map((photo, slotIdx) => (
              <div
                key={photo.id}
                className={`${styles.slot} ${slotIdx === 1 ? styles.slotLower : ""}`}
                aria-label={`Photo ${pageIdx * 2 + slotIdx + 1}`}
              >
                <div className={styles.photoFrame}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.photo} src={photo.dataUrl} alt="" />
                </div>
                <div className={styles.caption}>
                  {photo.location.trim() && (
                    <p>
                      <span className={styles.label}>Location :</span> {photo.location}
                    </p>
                  )}
                  {photo.size.trim() && (
                    <p>
                      <span className={styles.label}>Size :</span> {photo.size}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
