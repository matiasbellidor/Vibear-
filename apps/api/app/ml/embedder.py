import numpy as np
from PIL import Image

BATCH_SIZE = 32


class ClipEmbedder:
    """CLIP image encoder. Default model is FashionCLIP (CLIP fine-tuned on fashion products)."""

    def __init__(self, model_id: str):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self._torch = torch
        self._model = CLIPModel.from_pretrained(model_id).eval()
        self._processor = CLIPProcessor.from_pretrained(model_id)

    def embed(self, images: list[Image.Image]) -> np.ndarray:
        """Return L2-normalised vectors (n, dim), so a dot product is the cosine similarity."""
        torch = self._torch
        chunks = []
        with torch.inference_mode():
            for start in range(0, len(images), BATCH_SIZE):
                inputs = self._processor(images=images[start : start + BATCH_SIZE], return_tensors="pt")
                # transformers 5: get_image_features returns a model output; pooler_output is the projected embedding.
                chunks.append(self._model.get_image_features(**inputs).pooler_output)
        features = torch.cat(chunks)
        return torch.nn.functional.normalize(features, dim=-1).numpy()

    def embed_text(self, texts: list[str]) -> np.ndarray:
        """Text vectors in the same space as the images (zero-shot naming, see describe.py)."""
        torch = self._torch
        with torch.inference_mode():
            inputs = self._processor(text=texts, return_tensors="pt", padding=True)
            features = self._model.get_text_features(**inputs).pooler_output
        return torch.nn.functional.normalize(features, dim=-1).numpy()
