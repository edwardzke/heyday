// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HeydayApp",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(
            name: "HeydayApp",
            targets: ["HeydayApp"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "HeydayApp",
            dependencies: [],
            path: "Sources"
        ),
        .testTarget(
            name: "HeydayAppTests",
            dependencies: ["HeydayApp"],
            path: "Tests"
        )
    ]
)
