const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let shapes = [];
let currentShape = null;
let isDrawing = false;
let image = new Image();

// Set a default canvas size; it will be adjusted when an image is loaded.
canvas.width = 800;
canvas.height = 600;

// -------------------------
// Image Upload & Display
// -------------------------
document.getElementById("uploadImage").addEventListener("change", function (event) {
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
// Start a New Shape
// -------------------------
function startNewShape() {
  const name = prompt("Enter Shape Name:");
  if (!name) return;
  currentShape = { name, points: [] };
  shapes.push(currentShape);
  isDrawing = true;
}

// -------------------------
// Canvas Click – Place a Point
// -------------------------
canvas.addEventListener("click", function (event) {
  if (!isDrawing) return;

  let x = event.offsetX;
  let y = event.offsetY;

  // For the very first point, record the exact position.
  if (currentShape.points.length === 0) {
    currentShape.points.push({ x, y });
  } else {
    // For subsequent points, apply snapping.
    ({ x, y } = getSnappedPoint(x, y));
    currentShape.points.push({ x, y });
  }

  // If the new point is near the first point (and at least three points exist), close the shape.
  if (currentShape.points.length > 2 && isNearFirstPoint(x, y)) {
    currentShape.points.push(currentShape.points[0]); // Close the loop.
    isDrawing = false;
    updateJsonOutput();
    redrawCanvas();
    return;
  }

  redrawCanvas();
});

// -------------------------
// Mouse Move – Draw Preview Line
// -------------------------
canvas.addEventListener("mousemove", function (event) {
  if (!isDrawing || currentShape.points.length === 0) return;

  let x = event.offsetX;
  let y = event.offsetY;

  // For preview, if at least one point exists, snap the line.
  if (currentShape.points.length > 0) {
    ({ x, y } = getSnappedPoint(x, y));
  }

  redrawCanvas();

  // Draw the preview line from the last placed point to the current mouse position.
  const lastPoint = currentShape.points[currentShape.points.length - 1];
  ctx.strokeStyle = "blue";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(x, y);
  ctx.stroke();
});

// -------------------------
// Snapping Function
// -------------------------
function getSnappedPoint(x, y) {
  const snapSize = 10; // Change to adjust snapping sensitivity
  // Snap to the grid:
  x = Math.round(x / snapSize) * snapSize;
  y = Math.round(y / snapSize) * snapSize;

  if (currentShape.points.length > 0) {
    const lastPoint = currentShape.points[currentShape.points.length - 1];
    const dx = Math.abs(x - lastPoint.x);
    const dy = Math.abs(y - lastPoint.y);

    // Snap to the dominant axis (horizontal if dx > dy, vertical otherwise)
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
  const firstPoint = currentShape.points[0];
  return Math.abs(firstPoint.x - x) < 15 && Math.abs(firstPoint.y - y) < 15;
}

// -------------------------
// Redraw Canvas (Image + All Shapes)
// -------------------------
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) {
    ctx.drawImage(image, 0, 0);
  }
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
    ctx.stroke();
  });
}

// -------------------------
// Undo Last Point (for current shape)
// -------------------------
function undoLastPoint() {
  if (currentShape && currentShape.points.length > 0) {
    currentShape.points.pop();
    redrawCanvas();
  }
}

// -------------------------
// Reset the Canvas and All Shapes
// -------------------------
function resetCanvas() {
  shapes = [];
  currentShape = null;
  isDrawing = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image.src) {
    ctx.drawImage(image, 0, 0);
  }
  updateJsonOutput();
}

// -------------------------
// Update the JSON Output Display
// -------------------------
function updateJsonOutput() {
  document.getElementById("jsonOutput").value = JSON.stringify(shapes, null, 2);
}

// -------------------------
// Export JSON (download file)
// -------------------------
function exportJSON() {
  const blob = new Blob([JSON.stringify(shapes, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "floorplan.json";
  link.click();
}
