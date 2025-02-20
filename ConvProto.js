const canvas = document.getElementById("floorCanvas");
    const ctx = canvas.getContext("2d");

    let scale = 1;
    let offsetX = 0, offsetY = 0;
    let isDragging = false;
    let lastX, lastY;
    let lastTouchDistance = 0;
    let lastPinchScale = 1;
    let roomsData = [];

    function updateCanvasSize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (roomsData.length > 0) {
        drawRooms(roomsData);
      }
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
      drawUserLocation();
      ctx.restore();
    }

    function getRandomColor() {
      return `hsl(${Math.random() * 360}, 70%, 70%)`;
    }

    function drawRoom(room) {
      if (room.name.toLowerCase().includes("boundary")) {
        ctx.beginPath();
        const firstPoint = room.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        room.points.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        const firstPoint = room.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        room.points.forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();
        ctx.fillStyle = room.color || getRandomColor();
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // function drawUserLocation() {
    //   ctx.beginPath();
    //   ctx.arc(200, 250, 5, 0, Math.PI * 2);
    //   ctx.fillStyle = "blue";
    //   ctx.fill();
    //   ctx.strokeStyle = "black";
    //   ctx.lineWidth = 2;
    //   ctx.stroke();
    // }

    async function loadJson() {
      try {
        // console.log("json loaded")
        const response = await fetch('./PG_01.json');
        let jsonData = await response.json();
        jsonData = jsonData.map(room => ({
          ...room,
          color: room.color || getRandomColor()
        }));
        roomsData = jsonData;
        drawRooms(roomsData);
      } catch (error) {
        console.error('Error loading JSON:', error);
      }
    }

    function resetPosition() {
      offsetX = 0;
      offsetY = 0;
      scale = 1;
      drawRooms(roomsData);
    }

    // Enhanced touch handling
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Store initial pinch distance
        lastTouchDistance = getTouchDistance(e.touches);
        lastPinchScale = scale;
      } else if (e.touches.length === 1) {
        isDragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        // Pinch to zoom
        const currentDistance = getTouchDistance(e.touches);
        const pinchScale = currentDistance / lastTouchDistance;
        scale = lastPinchScale * pinchScale;
        scale = Math.min(Math.max(0.5, scale), 5); // Limit zoom
        drawRooms(roomsData);
      } else if (e.touches.length === 1 && isDragging) {
        // Single finger pan
        const touch = e.touches[0];
        const dx = touch.clientX - lastX;
        const dy = touch.clientY - lastY;
        offsetX += dx;
        offsetY += dy;
        lastX = touch.clientX;
        lastY = touch.clientY;
        drawRooms(roomsData);
      }
    });

    canvas.addEventListener('touchend', () => {
      isDragging = false;
      lastTouchDistance = 0;
    });

    // Helper function to calculate touch distance
    function getTouchDistance(touches) {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    // Enhanced trackpad/mouse handling
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Check if it's a trackpad gesture (pinch)
      if (e.ctrlKey) {
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        scale *= scaleFactor;
        scale = Math.min(Math.max(0.5, scale), 5); // Limit zoom
      } else {
        // Regular scrolling for panning
        offsetX -= e.deltaX;
        offsetY -= e.deltaY;
      }
      
      drawRooms(roomsData);
    });

    // Mouse drag handling
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

    // Initialize
    window.addEventListener("resize", updateCanvasSize);
    updateCanvasSize();
    loadJson();