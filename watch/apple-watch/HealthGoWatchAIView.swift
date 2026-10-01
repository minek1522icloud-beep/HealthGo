import SwiftUI

struct HealthGoWatchAIView: View {
    @StateObject private var service = HealthGoWatchAIService()
    @State private var message = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                TextField("Napisz lub podyktuj", text: $message)

                Button {
                    Task {
                        await service.ask(message)
                    }
                } label: {
                    if service.isLoading {
                        ProgressView()
                    } else {
                        Label("Wyślij", systemImage: "arrow.up.circle.fill")
                    }
                }
                .disabled(message.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || service.isLoading)

                if !service.answer.isEmpty {
                    Text(service.answer)
                        .font(.footnote)
                }

                if let error = service.errorMessage {
                    Text("AI: \(error)")
                        .font(.caption2)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("AI")
    }
}
