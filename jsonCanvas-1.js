const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageUpload = document.getElementById("uploadImage");
const originalScaleInput = document.getElementById("originalScale");
const referenceScaleInput = document.getElementById("referenceScale");
const jsonOutput = document.getElementById("jsonOutput");
const toolButtons = document.querySelectorAll("#toolControls .tool-button");

let shapes = []; // Represents rooms
let currentShape = null;
let isDrawing = false;
let image = new Image();
let nodes = [];
let edges = [];
let nextNodeId = 1; // To assign unique IDs to nodes
let selectedNodes = []; // For connecting edges
let currentTool = 'drawRoom'; // Default tool

// Undo/Redo History
let history = [];
let redoStack = [];

// Set a default canvas size; it will be adjusted when an image is loaded.
canvas.width = 800;
canvas.height = 600;

// -------------------------
// Scale Factors
// -------------------------
let originalScaleFactor = parseFloat(originalScaleInput.value) || 1.0;
let referenceScaleFactor = parseFloat(referenceScaleInput.value) || 100.0;

originalScaleInput.addEventListener("change", () => {
    originalScaleFactor = parseFloat(originalScaleInput.value) || 1.0;
});

referenceScaleInput.addEventListener("change", () => {
    referenceScaleFactor = parseFloat(referenceScaleInput.value) || 100.0;
});

// -------------------------
// Image Upload & Display
// -------------------------
imageUpload.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            image.onload = function () {
                canvas.width = image.width;
                canvas.height = image.height;
                redrawCanvas();
            };
            image.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// -------------------------
// Load JSON Functionality
// -------------------------
// const loadJSONFileInput = document.createElement('input'); // Create the input element in JS
// loadJSONFileInput.type = 'file';
// loadJSONFileInput.id = 'loadJSONFile';
// loadJSONFileInput.accept = '.json';
// loadJSONFileInput.style.display = 'none'; // Hide it
// document.body.appendChild(loadJSONFileInput); // Append to the body (or any other container)

// const openJSONButton = document.createElement('button');
// openJSONButton.textContent = 'Open JSON';
// openJSONButton.onclick = () => loadJSONFileInput.click();
// const controlsDiv = document.getElementById('controls'); // Assuming you have a div with id="controls" in your HTML
// if (controlsDiv) {
//     controlsDiv.appendChild(openJSONButton);
// } else {
//     console.error("Error: 'controls' div not found in HTML to append 'Open JSON' button.");
// }


loadJSONFileInput.addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const loadedData = JSON.parse(e.target.result);
                console.log("Loaded JSON Data:", loadedData); // ADD THIS LINE FOR DEBUGGING

                // Load the data into our current state
                if (loadedData.originalScaleFactor !== undefined) {
                    originalScaleFactor = loadedData.originalScaleFactor;
                    originalScaleInput.value = originalScaleFactor;
                }
                if (loadedData.referenceScaleFactor !== undefined) {
                    referenceScaleFactor = loadedData.referenceScaleFactor;
                    referenceScaleInput.value = referenceScaleFactor;
                }
                shapes = loadedData.rooms ? loadedData.rooms.map(room => ({
                    name: room.name,
                    type: room.type,
                    points: room.coordinates.map(coord => ({ x: coord.x, y: coord.y }))
                })) : [];
                console.log("Loaded Shapes:", shapes); // ADD THIS LINE FOR DEBUGGING
                nodes = loadedData.nodes ? loadedData.nodes.map(node => ({
                    id: node.id,
                    coordinates: { x: node.coordinates.x, y: node.coordinates.y }
                })) : [];
                console.log("Loaded Nodes:", nodes); // ADD THIS LINE FOR DEBUGGING
                edges = loadedData.edges ? loadedData.edges : [];
                console.log("Loaded Edges:", edges); // ADD THIS LINE FOR DEBUGGING

                // Find the next available node ID
                if (nodes.length > 0) {
                    const existingIds = nodes.map(n => parseInt(n.id.split('-')[1])).filter(id => !isNaN(id));
                    if (existingIds.length > 0) {
                        nextNodeId = Math.max(...existingIds) + 1;
                    } else {
                        nextNodeId = 1;
                    }
                } else {
                    nextNodeId = 1;
                }

                resetHistory(); // Clear current history
                saveState();    // Save the loaded state
                redrawCanvas();
                updateJsonOutput();

                alert("JSON file loaded successfully!");

            } catch (error) {
                alert("Error loading JSON file: " + error);
                console.error("Error loading JSON:", error);
            }
        };
        reader.readAsText(file);
    }
});

// -------------------------
// Tool Selection
// -------------------------
function setTool(tool) {
    currentTool = tool;
    isDrawing = false; // Stop room drawing when switching tools
    selectedNodes = []; // Reset node selection
    toolButtons.forEach(button => button.classList.remove('active'));
    const activeButton = document.querySelector(`#toolControls button[onclick="setTool('${tool}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    canvas.style.cursor = getCursorForTool(tool);
    redrawCanvas();
}

function getCursorForTool(tool) {
    switch (tool) {
        case 'drawRoom':
            return 'crosshair';
        case 'placeNode':
            return 'pointer';
        case 'connectEdge':
            return 'grab';
        default:
            return 'default';
    }
}

// -------------------------
// Start a New Shape (Room)
// -------------------------
function startNewShape() {
    const name = prompt("Enter Room Name:");
    if (!name) return;
    currentShape = { name, type: 'room', points: [] };
    shapes.push(currentShape);
    isDrawing = true;
}

// -------------------------
// Add Node
// -------------------------
function addNode(x, y) {
    const id = `node-${nextNodeId++}`;
    nodes.push({ id, coordinates: { x, y } });
    redrawCanvas();
}

// -------------------------
// Connect Nodes (Start)
// -------------------------
function startConnectNodes(nodeId) {
    if (selectedNodes.includes(nodeId)) {
        selectedNodes = selectedNodes.filter(id => id !== nodeId); // Deselect if already selected
    } else {
        selectedNodes.push(nodeId);
    }

    if (selectedNodes.length === 2) {
        connectSelectedNodes();
        selectedNodes = [];
    }
    redrawCanvas(); // To highlight selected nodes
}

// -------------------------
// Connect Selected Nodes
// -------------------------
function connectSelectedNodes() {
    const node1 = nodes.find(n => n.id === selectedNodes[0]);
    const node2 = nodes.find(n => n.id === selectedNodes[1]);
    if (node1 && node2) {
        const weight = calculateDistance(node1.coordinates, node2.coordinates);
        const existingEdge = edges.find(edge =>
            (edge.sourceNodeId === node1.id && edge.targetNodeId === node2.id) ||
            (edge.sourceNodeId === node2.id && edge.targetNodeId === node1.id)
        );
        if (!existingEdge) {
            edges.push({ sourceNodeId: node1.id, targetNodeId: node2.id, weight });
        } else {
            console.log("Edge already exists between these nodes.");
        }
        redrawCanvas();
    }
}

// -------------------------
// Calculate Distance
// -------------------------
function calculateDistance(coord1, coord2) {
    const dx = coord2.x - coord1.x;
    const dy = coord2.y - coord1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

// -------------------------
// Canvas Click Handler
// -------------------------
canvas.addEventListener("click", function (event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (currentTool === 'drawRoom') {
        handleDrawRoomClick(event);
    } else if (currentTool === 'placeNode') {
        addNode(x, y);
    } else if (currentTool === 'connectEdge') {
        const clickedNode = findClickedNode(x, y);
        if (clickedNode) {
            startConnectNodes(clickedNode.id);
        }
    }
});

function handleDrawRoomClick(event) {
    if (!isDrawing) {
        startNewShape();
        return;
    }

    let snappedX = event.offsetX;
    let snappedY = event.offsetY;

    if (currentShape.points.length > 0) {
        ({ x: snappedX, y: snappedY } = getSnappedPoint(snappedX, snappedY));
    }
    currentShape.points.push({ x: snappedX, y: snappedY });

    if (currentShape.points.length > 2 && isNearFirstPoint(snappedX, snappedY)) {
        currentShape.points.push(currentShape.points[0]); // Close the loop.
        isDrawing = false;
        updateJsonOutput();
        redrawCanvas();
        return;
    }
    redrawCanvas();
}

function findClickedNode(x, y) {
    const nodeRadius = 10; // Increased radius for easier clicking
    return nodes.find(node =>
        Math.abs(x - node.coordinates.x) < nodeRadius && Math.abs(y - node.coordinates.y) < nodeRadius
    );
}

// -------------------------
// Mouse Move – Draw Preview Line (for Room Drawing)
// -------------------------
canvas.addEventListener("mousemove", function (event) {
    if (currentTool === 'drawRoom' && isDrawing && currentShape.points.length > 0) {
        let x = event.offsetX;
        let y = event.offsetY;

        ({ x, y } = getSnappedPoint(x, y));

        redrawCanvas();

        const lastPoint = currentShape.points[currentShape.points.length - 1];
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
    }
});

// -------------------------
// Snapping Function
// -------------------------
function getSnappedPoint(x, y) {
    const snapSize = 10;
    x = Math.round(x / snapSize) * snapSize;
    y = Math.round(y / snapSize) * snapSize;

    if (currentShape.points.length > 0) {
        const lastPoint = currentShape.points[currentShape.points.length - 1];
        const dx = Math.abs(x - lastPoint.x);
        const dy = Math.abs(y - lastPoint.y);

        if (dx > dy) {
            y = lastPoint.y;
        } else {
            x = lastPoint.x;
        }
    }
    return { x, y };
}

// -------------------------
// Check if a Point is Near the First Point
// -------------------------
function isNearFirstPoint(x, y) {
    if (!currentShape || currentShape.points.length === 0) return false;
    const firstPoint = currentShape.points[0];
    const threshold = 15;
    return Math.abs(firstPoint.x - x) < threshold && Math.abs(firstPoint.y - y) < threshold;
}

// -------------------------
// Redraw Canvas (Image + All Shapes + Nodes + Edges)
// -------------------------
function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image.src) {
        ctx.drawImage(image, 0, 0);
    }
    // Draw Shapes (Rooms)
    shapes.forEach(shape => {
        ctx.beginPath();
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        shape.points.forEach((point, index) => {
            if (index === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        });
        ctx.closePath(); // Ensure the shape is closed
        ctx.stroke();
    });

    // Draw Nodes
    nodes.forEach(node => {
        ctx.beginPath();
        ctx.arc(node.coordinates.x, node.coordinates.y, 8, 0, 2 * Math.PI); // Slightly larger radius
        ctx.fillStyle = "green";
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "black";
        ctx.font = "10px Arial";
        ctx.fillText(node.id, node.coordinates.x + 10, node.coordinates.y + 3); // Adjusted position
    });

    // Draw Edges
    edges.forEach(edge => {
        const startNode = nodes.find(n => n.id === edge.sourceNodeId);
        const endNode = nodes.find(n => n.id === edge.targetNodeId);
        if (startNode && endNode) {
            ctx.beginPath();
            ctx.moveTo(startNode.coordinates.x, startNode.coordinates.y);
            ctx.lineTo(endNode.coordinates.x, endNode.coordinates.y);
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Display weight (optional)
            const midX = (startNode.coordinates.x + endNode.coordinates.x) / 2;
            const midY = (startNode.coordinates.y + endNode.coordinates.y) / 2;
            ctx.fillStyle = "blue";
            ctx.font = "10px Arial";
            ctx.fillText(edge.weight.toFixed(2), midX + 5, midY - 5);
        }
    });

    // Highlight selected nodes for edge connection
    selectedNodes.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            ctx.beginPath();
            ctx.arc(node.coordinates.x, node.coordinates.y, 10, 0, 2 * Math.PI); // Larger highlight
            ctx.strokeStyle = "orange";
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    });
}


// Undo Last Point (for current shape)

function undoLastPoint() {
    if (currentShape && currentShape.points.length > 0) {
        currentShape.points.pop();
        redrawCanvas();
    }
}


// Reset the Canvas and All Data

function resetCanvas() {
    shapes = [];
    currentShape = null;
    isDrawing = false;
    nodes = [];
    edges = [];
    nextNodeId = 1;
    selectedNodes = [];
    currentTool = 'drawRoom'; // Reset tool
    toolButtons.forEach(button => button.classList.remove('active'));
    toolButtons[0].classList.add('active'); // Set 'Draw Room' as active
    canvas.style.cursor = getCursorForTool(currentTool);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (image.src) {
        ctx.drawImage(image, 0, 0);
    }
    updateJsonOutput();
}


// Update the JSON Output Display
function updateJsonOutput() {
    const output = {
        originalScaleFactor: originalScaleFactor,
        referenceScaleFactor: referenceScaleFactor,
        rooms: shapes.map(shape => ({ name: shape.name, type: shape.type, coordinates: shape.points.map(p => ({ x: p.x, y: p.y })) })),
        nodes: nodes.map(node => ({ id: node.id, coordinates: node.coordinates })),
        edges: edges
    };
    jsonOutput.value = JSON.stringify(output, null, 2);
}

// -------------------------
// Normalize Coordinates
// -------------------------
function normalizeCoordinates(coordinate, originalScale, referenceScale) {
    if (originalScale === 0) return 0;
    return (coordinate / originalScale) * referenceScale;
}


// Export JSON (download file) with Scale Normalization

function exportJSON() {
    if (!image.src) {
        alert('Please upload an image first.');
        return;
    }

    const normalizedRooms = shapes.map(shape => ({
        name: shape.name,
        type: shape.type,
        coordinates: shape.points.map(p => ({
            x: normalizeCoordinates(p.x, originalScaleFactor, referenceScaleFactor),
            y: normalizeCoordinates(p.y, originalScaleFactor, referenceScaleFactor)
        }))
    }));

    const normalizedNodes = nodes.map(node => ({
        id: node.id,
        coordinates: {
            x: normalizeCoordinates(node.coordinates.x, originalScaleFactor, referenceScaleFactor),
            y: normalizeCoordinates(node.coordinates.y, originalScaleFactor, referenceScaleFactor)
        }
    }));

    const normalizedEdges = edges.map(edge => ({
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        weight: edge.weight ? normalizeCoordinates(edge.weight, originalScaleFactor, referenceScaleFactor) : 0
    }));

    const outputJSON = {
        originalScaleFactor: originalScaleFactor,
        referenceScaleFactor: referenceScaleFactor,
        rooms: normalizedRooms,
        nodes: normalizedNodes,
        edges: normalizedEdges
    };

    const blob = new Blob([JSON.stringify(outputJSON, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "floorplan.json";
    link.click();
}
function saveState() {
    const currentState = {
        shapes: JSON.parse(JSON.stringify(shapes)), // Deep copy
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        nextNodeId: nextNodeId
    };
    history.push(currentState);
    redoStack = []; // Clear redo stack on new action
    if (history.length > 10) { // Limit history size
        history.shift();
    }
}
 //------------------
 //HISTORY
 //--------------
function undo() {
    if (history.length > 1) {
        redoStack.push(history.pop());
        const previousState = history[history.length - 1];
        shapes = previousState.shapes;
        nodes = previousState.nodes;
        edges = previousState.edges;
        nextNodeId = previousState.nextNodeId;
        redrawCanvas();
        updateJsonOutput();
    }
}

function redo() {
    if (redoStack.length > 0) {
        const nextState = redoStack.pop();
        history.push(nextState);
        shapes = nextState.shapes;
        nodes = nextState.nodes;
        edges = nextState.edges;
        nextNodeId = nextState.nextNodeId;
        redrawCanvas();
        updateJsonOutput();
    }
}

function resetHistory() {
    history = [];
    redoStack = [];
    saveState(); // Save initial state after reset or image load
}

// Save initial state
resetHistory();