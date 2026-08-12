# Image Editor Canvas

A **web‑based, Canva‑style image editor** for designing social media carousels, posts, and visual content directly in your browser. No sign‑up, no backend – everything runs client‑side.

Built with vanilla HTML, CSS, and JavaScript, this editor lets you combine images and text on a flexible canvas, adjust aspect ratios, and export your creation as a high‑resolution PNG image.

---

## ✨ Features

### Canvas & Aspect Ratios
- **Preset aspect ratios**: 1:1 (square), 4:5, 9:16 (story), 16:9 (landscape), 2:3 and more.
- **Custom canvas size**: the canvas adapts to the selected ratio and your screen, keeping the design area clean and usable.

### Image Handling
- **Upload multiple images** – drag & drop or use the toolbox button.
- **Swap images** on the fly from the properties panel.
- **Resize images** using 8 drag handles (corners, edges) for independent width/height or proportional scaling.
- **Image fit mode** (right‑click context menu):
  - **Fill** – stretches the image to the exact container size (no crop).
  - **Cover** – scales the image to cover the container while maintaining aspect ratio (crops as needed, like `object-fit: cover`).
- **Scale to canvas** – instantly fit an image to the full canvas while preserving its aspect ratio.

### Text Elements
- **Click‑to‑edit** text boxes – just like PowerPoint, select a text element and start typing.
- **Style options**:
  - Font size
  - Text color
  - Background color (including transparent)
  - Text shadow (custom CSS shadow string)
- **Live preview** – all changes appear immediately.

### Layering & Organisation
- **Drag** any element (text or image) freely on the canvas.
- **Bring to front / Send to back** via right‑click context menu.
- **Duplicate** elements in one click.
- **Delete** elements when they’re no longer needed.

### Background & Canvas Settings
- **Custom background colour** – choose any solid color for the canvas using the toolbox colour picker.

### Export
- **Export to PNG** – download your design as a high‑resolution (2x) image with the click of a button.
- All elements (text, images, shadows) are captured exactly as they appear on screen.

---

## 🚀 How to Use

1. Open the `index.html` file in a modern browser (Chrome, Firefox, Edge).
2. **Set the aspect ratio** using the buttons in the top bar (e.g. 1:1 for a square post).
3. **Add elements**:
   - Click **Text** in the left toolbox to insert a text box.
   - Click **Image** to upload an image (or drag and drop it onto the canvas area).
4. **Edit**:
   - **Click** an element to select it. Handles appear around images, and text becomes editable.
   - **Drag** to move an element.
   - Use the **right‑click menu** to bring forward/send backward, duplicate, delete, or change image fit mode.
   - Use the **properties panel** on the right to change text content, font size, colours, shadow, or swap images.
5. **Export** – click the **Export Image** button in the top bar to download your design as a PNG.

---

## 🧱 Tech Stack

| Layer        | Technology                         |
|--------------|------------------------------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript    |
| **Export**   | [html2canvas](https://html2canvas.hertzen.com/) (loaded via CDN) |
| **Images**   | Local file uploads (Data URIs, no server required) |

No frameworks, no build tools – just open and run.

---

## 📁 Project Structure
