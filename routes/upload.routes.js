
import express from "express";
import multer from "multer";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post(
  "/upload-image",
  verifyToken,
  verifyAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image.",
        });
      }

      const apiKey = process.env.IMGBB_API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          success: false,
          message: "ImgBB API key is missing.",
        });
      }

      const formData = new FormData();

      formData.append(
        "image",
        req.file.buffer.toString("base64")
      );

      const response = await fetch(
        `https://api.imgbb.com/1/upload?key=${apiKey}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error("ImgBB Error:", result);

        return res.status(400).json({
          success: false,
          message: result.error?.message || "Image upload failed.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully!",
        data: {
          url: result.data.url,
          deleteUrl: result.data.delete_url,
        },
      });
    } catch (error) {
      console.error("Image upload error:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to upload image.",
      });
    }
  }
);

export default router;
