# ViewerAggregate

ViewerAggregate is a web application that integrates Autodesk Platform Services (APS) to provide a 3D model viewer. It allows users to upload, view, and manage 3D models, as well as create composite designs by combining multiple models.

## Features

- **3D Model Viewer**: View 3D models using Autodesk's Forge Viewer.
- **Model Upload**: Upload 3D models (including `.zip` files with multiple assets).
- **Model Management**: List, delete, and check the translation status of uploaded models.
- **Composite Designs**: Create and manage composite designs by combining multiple models.
- **Responsive UI**: A user-friendly interface for managing and viewing models.

## Prerequisites

Before running the application, ensure you have the following:

1. **Node.js**: Install Node.js (v14 or later).
2. **Autodesk Platform Services Credentials**:
   - Create an APS app at [Autodesk Developer Portal](https://aps.autodesk.com/).
   - Obtain your `APS_CLIENT_ID` and `APS_CLIENT_SECRET`.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lagzles/viewerAggregate.git
   cd viewerAggregate

2. Instal depedencies 
    npm install

3. create .env
    APS_CLIENT_ID=your-client-id
    APS_CLIENT_SECRET=your-client-secret
    APS_BUCKET=your-bucket-name (optional, defaults to <client-id>-basic-app)
    PORT=8080 (optional, defaults to 8080)

4. Start the server
    npm run start

5. Open your browser and navigate to http://localhost:8080.

## Usage
Uploading Models
Click the Upload button in the header.
Select a 3D model file or a .zip archive containing multiple assets.
If uploading a .zip file, specify the main design file inside the archive.

## Viewing Models
Select a model from the dropdown menu to load it into the viewer.
Use the sidebar to manage loaded models.

## Creating Composite Designs
Load at least two models into the viewer.
Press Ctrl + C to open the composite design panel.
Enter a name for the composite design and click Create Composite.

## Managing Models
Use the sidebar to delete models or toggle their visibility in the viewer.

## Project Structure
server.js: Entry point for the Express server.
routes/: API routes for authentication, model management, and composite designs.
services/aps.js: Service layer for interacting with Autodesk Platform Services.
wwwroot/: Frontend assets (HTML, CSS, JavaScript).
config.js: Configuration file for environment variables.

## Debugging
This project includes a .vscode/launch.json file for debugging in Visual Studio Code. You can launch or attach to the Node.js process or debug the frontend in Chrome.

License
This project is licensed under the MIT License. See the LICENSE file for details.

Contributing
Contributions are welcome! Feel free to open issues or submit pull requests.

Acknowledgments
Autodesk Platform Services
Forge Viewer
