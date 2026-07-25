import type { Deck } from "./pptx.functions";

/** Builds and downloads a .pptx file from a deck, including any generated images. */
export async function downloadDeck(deck: Deck) {
  const pptxgen = (await import("pptxgenjs")).default;
  const pres = new pptxgen();
  pres.title = deck.title;
  pres.layout = "LAYOUT_WIDE";

  deck.slides.forEach((slide, i) => {
    const s = pres.addSlide();
    const isTitle = i === 0;
    const hasImage = Boolean(slide.imageDataUrl) && !isTitle;
    s.background = { color: isTitle ? "1E1B4B" : "FFFFFF" };

    s.addText(slide.title, {
      x: 0.5, y: isTitle ? 2.5 : 0.4, w: 12.3, h: isTitle ? 1.5 : 0.9,
      fontSize: isTitle ? 44 : 32, bold: true,
      color: isTitle ? "FFFFFF" : "1E1B4B", fontFace: "Calibri",
    });

    if (slide.bullets?.length && !isTitle) {
      s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true } })), {
        x: 0.5, y: 1.6, w: hasImage ? 6.4 : 12.3, h: 5.2,
        fontSize: hasImage ? 20 : 22, color: "333333", fontFace: "Calibri", paraSpaceAfter: 10,
      });
    } else if (slide.bullets?.length && isTitle) {
      s.addText(slide.bullets.join(" • "), {
        x: 0.5, y: 4.2, w: 12.3, h: 0.7, fontSize: 20, color: "C7D2FE", align: "center",
      });
    }

    if (hasImage) {
      s.addImage({
        data: slide.imageDataUrl!,
        x: 7.2, y: 1.6, w: 5.6, h: 3.75,
        sizing: { type: "contain", w: 5.6, h: 3.75 },
      });
    }
    if (slide.notes) s.addNotes(slide.notes);
  });

  await pres.writeFile({ fileName: `${deck.title.replace(/[^\w]+/g, "_")}.pptx` });
}
