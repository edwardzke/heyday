/*
See the LICENSE.txt file for this sample’s licensing information.

Abstract:
The sample app's main view controller that manages the scanning process.
*/

import UIKit
import RoomPlan

class RoomCaptureViewController: UIViewController, RoomCaptureViewDelegate, RoomCaptureSessionDelegate {
  
    var onFinished: ((String) -> Void)?
    var onCancelled: (() -> Void)?
  
    private var isScanning: Bool = false
  
    private var roomCaptureView: RoomCaptureView!
    private var roomCaptureSessionConfig: RoomCaptureSession.Configuration = RoomCaptureSession.Configuration()
    private var finalResults: CapturedRoom?
    
    private let finishButton = UIButton(type: .system)
    private let exportButton = UIButton(type: .system)

    @IBOutlet var doneButton: UIBarButtonItem?
    @IBOutlet var cancelButton: UIBarButtonItem?
    @IBOutlet var activityIndicator: UIActivityIndicatorView?
    
    override func viewDidLoad() {
        super.viewDidLoad()

        setupRoomCaptureView()
        setupFinishButton()
        setupExportButton()

        activityIndicator?.stopAnimating()
    }
  
    private func setupFinishButton() {
        finishButton.setTitle("Finish Scan", for: .normal)
        finishButton.setTitleColor(.white, for: .normal)
        finishButton.backgroundColor = .systemGreen
        finishButton.layer.cornerRadius = 22
        finishButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 18, bottom: 10, right: 18)

        finishButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(finishButton)

        NSLayoutConstraint.activate([
            finishButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            finishButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])

        finishButton.addTarget(self, action: #selector(finishScanTapped), for: .touchUpInside)
    }

    private func setupExportButton() {
        exportButton.setTitle("Export", for: .normal)
        exportButton.setTitleColor(.white, for: .normal)
        exportButton.backgroundColor = .systemBlue
        exportButton.layer.cornerRadius = 22
        exportButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 24, bottom: 10, right: 24)

        exportButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(exportButton)

        NSLayoutConstraint.activate([
            exportButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            exportButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])

        exportButton.addTarget(self, action: #selector(exportResults(_:)), for: .touchUpInside)

        // initially disabled until finalResults exists
        exportButton.isEnabled = false
        exportButton.alpha = 0.5
    }
    
    private func setupRoomCaptureView() {
        roomCaptureView = RoomCaptureView(frame: view.bounds)
        roomCaptureView.captureSession.delegate = self
        roomCaptureView.delegate = self
        
        view.insertSubview(roomCaptureView, at: 0)
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        startSession()
    }
    
    override func viewWillDisappear(_ flag: Bool) {
        super.viewWillDisappear(flag)
        stopSession()
    }
    
    private func startSession() {
        isScanning = true
        roomCaptureView?.captureSession.run(configuration: roomCaptureSessionConfig)
    }
    
    private func stopSession() {
        isScanning = false
        roomCaptureView?.captureSession.stop()
    }
    
    @objc private func finishScanTapped() {
        if isScanning {
            activityIndicator?.startAnimating()
            stopSession()
        }
    }

    // Decide to post-process and show the final results.
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        return true
    }
    
    // Access the final post-processed results.
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        finalResults = processedResult

        isScanning = false
        activityIndicator?.stopAnimating()

        exportButton.isEnabled = true
        exportButton.alpha = 1.0
    }
    
    @IBAction func doneScanning(_ sender: UIBarButtonItem) {
        if isScanning { stopSession() } else { cancelScanning(sender) }
        self.exportButton.isEnabled = false
        self.activityIndicator?.startAnimating()
    }

    @IBAction func cancelScanning(_ sender: UIBarButtonItem) {
        onCancelled?()
        dismiss(animated: true)
    }

    // Export the USDZ output by specifying the `.mesh` export option.
    // Alternatively, `.parametric` exports the model as unit-sized cubes and `.all`
    // exports both in a single USDZ.
    @IBAction func exportResults(_ sender: UIButton) {
        // must NOT be scanning, and we need finalResults
        guard !isScanning, let finalResults else { return }

        do {
            // 1) Choose a persistent, app-accessible folder
            let docsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
            let scansFolderURL = docsURL.appendingPathComponent("RoomScans", isDirectory: true)
            try FileManager.default.createDirectory(at: scansFolderURL, withIntermediateDirectories: true)

            // unique filename
            let usdzURL = scansFolderURL.appendingPathComponent("Room-\(UUID().uuidString).usdz")

            // 2) Export USDZ
            try finalResults.export(to: usdzURL, exportOptions: .mesh)

            // 3) Also encode the CapturedRoom data as JSON (optional but useful)
            let jsonEncoder = JSONEncoder()
            let roomJsonData = try jsonEncoder.encode(finalResults)
            let roomJsonString = String(data: roomJsonData, encoding: .utf8) ?? "{}"

            // 4) Build a simple payload object for JS
            let payload: [String: Any] = [
                "usdzPath": usdzURL.path,    // native file path
                "roomJson": roomJsonString   // json string of CapturedRoom
            ]

            let payloadData = try JSONSerialization.data(withJSONObject: payload, options: [])
            let payloadString = String(data: payloadData, encoding: .utf8) ?? "{}"

            // 5) Send back to React Native and close the scanner
            onFinished?(payloadString)
            dismiss(animated: true, completion: nil)

        } catch {
            print("Export error: \(error)")
            onFinished?("{\"error\":\"export_failed\"}")
            dismiss(animated: true, completion: nil)
        }
    }

    private func setActiveNavBar() {
        UIView.animate(withDuration: 1.0, animations: {
            self.cancelButton?.tintColor = .white
            self.doneButton?.tintColor = .white
          self.exportButton.isEnabled = true
            self.exportButton.alpha = 0.6
        }, completion: nil)
    }
    
    private func setCompleteNavBar() {
        self.exportButton.isHidden = false
        UIView.animate(withDuration: 1.0) {
            self.cancelButton?.tintColor = .systemBlue
            self.doneButton?.tintColor = .systemBlue
            self.exportButton.alpha = 1.0
        }
    }
}

