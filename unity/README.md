# Heyday Unity Module

Barebones Unity folder structure for integrating shared gameplay or rendering experiences.

## Getting Started

1. Open this folder in Unity Hub and create a new project using the **3D (URP)** or **2D** template.
2. Unity will populate the necessary `ProjectSettings` and `Packages` files automatically.
3. Use the `Assets/Scripts` folder to author bridge code that communicates with the iOS SwiftUI host or the web frontend via WebGL builds.

## Integration Notes

- For iOS, consider exporting a Unity as a Library module and linking it to the Swift Package or Xcode workspace.
- For web, produce a WebGL build and serve it via the Django backend or Vite dev server.
- Keep Unity-specific dependencies encapsulated here to avoid bloating other packages.
