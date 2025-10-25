import SwiftUI

public struct ContentView: View {
    public init() {}

    public var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("Heyday Companion")
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Text("Wire your shared UI here and integrate Unity or web views as needed.")
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                Button(action: {}) {
                    Text("Run Health Check")
                        .padding()
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .navigationTitle("Dashboard")
        }
    }
}

#Preview {
    ContentView()
}
