const canvas = document.getElementById("floorCanvas");
const ctx = canvas.getContext("2d");

let scale = 1;
let offsetX = 0, offsetY = 0;
let isDragging = false;
let lastX, lastY;
let roomsData = [];

function updateCanvasSize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 120;
  adjustScaleToFit();
  if (roomsData.length > 0) {
    drawRooms(roomsData);
  }
}

function adjustScaleToFit() {
  if (roomsData.length === 0) return;
  const maxWidth = Math.max(...roomsData.flatMap(room => room.points.map(p => p.x)));
  const maxHeight = Math.max(...roomsData.flatMap(room => room.points.map(p => p.y)));

  if (!maxWidth || !maxHeight) {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    return;
  }

  const scaleX = canvas.width / maxWidth;
  const scaleY = canvas.height / maxHeight;
  scale = Math.min(scaleX, scaleY) * 0.85;
  offsetX = 0;
  offsetY = 0;
}

function clearCanvas() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawRooms(rooms) {
  clearCanvas();
  ctx.save();
  ctx.translate(canvas.width / 2 + offsetX, canvas.height / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
  rooms.forEach(drawRoom);
  ctx.restore();
}

function drawRoom(room) {
  ctx.beginPath();
  const firstPoint = room.points[0];
  ctx.moveTo(firstPoint.x, firstPoint.y);
  room.points.forEach(point => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fillStyle = room.highlightColor ? room.highlightColor : (room.color || getRandomColor());
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawRoomLabel(room);
}

function drawRoomLabel(room) {
  const minX = Math.min(...room.points.map(p => p.x));
  const maxX = Math.max(...room.points.map(p => p.x));
  const minY = Math.min(...room.points.map(p => p.y));
  const maxY = Math.max(...room.points.map(p => p.y));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const roomWidth = maxX - minX;
  const roomHeight = maxY - minY;

  const fontSize = Math.max(6, Math.min(roomWidth, roomHeight) / 6);
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = "black";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(room.name, centerX, centerY);
}

function getRandomColor() {
  return `hsl(${Math.random() * 360}, 70%, 70%)`;
}

async function loadJson() {
  try {
    const response = await fetch('./new.json');
    const jsonData = await response.json();

    // Normalize rooms
    let loadedRoomsData = jsonData.rooms.map(room => ({
      name: room.name,
      type: room.type,
      points: room.coordinates,
      color: getRandomColor(),
      highlightColor: null // Initialize highlightColor to null
    }));

    // Load graph data
    graphNodes = jsonData.nodes || [];
    graphEdges = jsonData.edges || [];

    // Apply scale factors *before* adjusting scale to fit
    if (jsonData.originalScaleFactor && jsonData.referenceScaleFactor) {
      const factor = jsonData.originalScaleFactor / jsonData.referenceScaleFactor; // REVERSED THE DIVISION
      // Apply this factor to all points (rooms + nodes)
      loadedRoomsData.forEach(room => {
        room.points = room.points.map(p => ({
          x: p.x * factor,
          y: p.y * factor
        }));
      });

      graphNodes = graphNodes.map(node => ({
        ...node,
        coordinates: {
          x: node.coordinates.x * factor,
          y: node.coordinates.y * factor
        }
      }));
    }

    roomsData = loadedRoomsData; // Assign the scaled data back to roomsData

    adjustScaleToFit();
    drawRooms(roomsData);
  } catch (error) {
    console.error('Error loading JSON:', error);
  }
}
canvas.addEventListener('mousedown', (e) => {
  isDragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    offsetX += dx;
    offsetY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    drawRooms(roomsData);
  }
});

canvas.addEventListener('mouseup', () => {
  isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
  isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
  const newScale = scale * scaleFactor;
  scale = Math.min(Math.max(0.5, newScale), 5);

  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const scaleRatio = newScale / scale;
  offsetX = mouseX - (mouseX - offsetX) * scaleRatio;
  offsetY = mouseY - (mouseY - offsetY) * scaleRatio;

  drawRooms(roomsData);
});

window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();
loadJson();

function resetPosition() {
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  adjustScaleToFit();
  drawRooms(roomsData);
}

function applyRoomHighlights(currentLocation, destination) {
  const current = currentLocation ? currentLocation.toLowerCase() : null;
  const dest = destination ? destination.toLowerCase() : null;

  const sourceFound = current ? roomsData.some(room => room.name.toLowerCase() === current) : false;
  const destinationFound = dest ? roomsData.some(room => room.name.toLowerCase() === dest) : false;

  if ((current && !sourceFound) || (dest && !destinationFound)) {
    roomsData.forEach(room => {
      room.highlightColor = "grey";
    });
  } else {
    roomsData.forEach(room => {
      const roomName = room.name.toLowerCase();
      if (current && roomName === current) {
        room.highlightColor = "green";
      } else if (dest && roomName === dest) {
        room.highlightColor = "lightcoral";
      } else {
        room.highlightColor = "grey";
      }
    });
  }
  drawRooms(roomsData);
}

function findRoute() {
  const currentLocationInput = document.getElementById("currentLocation").value.trim();
  const finalDestinationInput = document.getElementById("finalDestination").value.trim();

  if (!currentLocationInput && !finalDestinationInput) {
    roomsData.forEach(room => {
      room.highlightColor = room.color;
    });
    drawRooms(roomsData);
    return;
  }

  applyRoomHighlights(currentLocationInput, finalDestinationInput);
}