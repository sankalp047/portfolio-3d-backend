# 3D Models Folder

Place your MacBook GLTF model here.

## Expected Files

After exporting from Blender, you should have:

```
models/
├── macbook.gltf      # Main model file (required)
├── macbook.bin       # Binary geometry data (if separate export)
└── textures/         # Texture images (if any)
```

## Export Settings for Blender

1. File → Export → glTF 2.0 (.glb/.gltf)
2. Format: glTF Separate (.gltf + .bin + textures)
3. Include: ✅ Selected Objects
4. Transform: ✅ +Y Up
5. Geometry: ✅ Apply Modifiers, ✅ UVs, ✅ Normals

## Notes

- The model will be automatically loaded by Three.js
- If no model is found, a placeholder laptop geometry will be displayed
- Recommended poly count: Under 50,000 for smooth performance
- Textures should be optimized (under 2048x2048)
