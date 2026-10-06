import { formatBuffer } from "./editor-format.js";
self.onmessage = async ({ data }) => {
  try {
    self.postMessage({
      text: await formatBuffer(data.path, data.text, data.options),
    });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
