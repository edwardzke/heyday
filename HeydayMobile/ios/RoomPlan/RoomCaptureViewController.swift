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
  
    private let exportButton = UIButton(type: .system)
    
    @IBOutlet var doneButton: UIBarButtonItem?
    @IBOutlet var cancelButton: UIBarButtonItem?
    @IBOutlet var activityIndicator: UIActivityIndicatorView?
    
    private var isScanning: Bool = false
    
    private var roomCaptureView: RoomCaptureView!
    private var roomCaptureSessionConfig: RoomCaptureSession.Configuration = RoomCaptureSession.Configuration()
    
    private var finalResults: CapturedRoom?
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Set up after loading the view.
        setupRoomCaptureView()
        setupExportButton()
        activityIndicator?.stopAnimating()
    }
  
    private func setupExportButton() {
        exportButton.setTitle("Export", for: .normal)
        exportButton.setTitleColor(.white, for: .normal)
        exportButton.backgroundColor = .systemBlue
        exportButton.layer.cornerRadius = 24
        exportButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 24, bottom: 10, right: 24)

        exportButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(exportButton)

        // Position it near the bottom center of the screen
        NSLayoutConstraint.activate([
            exportButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            exportButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])

        // Wire it to your existing @IBAction
        exportButton.addTarget(self, action: #selector(exportResults(_:)), for: .touchUpInside)
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
        
        setActiveNavBar()
    }
    
    private func stopSession() {
        isScanning = false
        roomCaptureView?.captureSession.stop()
        
        setCompleteNavBar()
    }
    
    // Decide to post-process and show the final results.
    func captureView(shouldPresent roomDataForProcessing: CapturedRoomData, error: Error?) -> Bool {
        return true
    }
    
    // Access the final post-processed results.
    func captureView(didPresent processedResult: CapturedRoom, error: Error?) {
        finalResults = processedResult
        exportButton.isEnabled = true
        exportButton.alpha = 1.0
        activityIndicator?.stopAnimating()
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
        // If we’re still scanning, first stop the session so RoomPlan can process
        if isScanning {
            stopSession()   // this will eventually trigger captureView(didPresent:...)
            return
        }

        // After scanning is done, we should have finalResults
        guard let finalResults else { return }

        do {
            let jsonEncoder = JSONEncoder()
            let jsonData = try jsonEncoder.encode(finalResults)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"

            // Send result back to React Native
            onFinished?(jsonString)

            // Optionally: also export USDZ / JSON files to disk here if you still want that
            // and/or show a share sheet.

            dismiss(animated: true, completion: nil)
        } catch {
            print("Encoding error: \(error)")
            onFinished?("{}")
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

