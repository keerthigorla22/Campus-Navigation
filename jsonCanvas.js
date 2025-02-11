document.addEventListener('DOMContentLoaded', () => {
    const image = document.getElementById('image');
    const addShapeBtn = document.getElementById('addShapeBtn');
    const completeShapeBtn = document.getElementById('completeShapeBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const jsonOutput = document.getElementById('jsonOutput');

    const originalImageWidth = 1000; // Replace with your image's original width
    const originalImageHeight = 800; // Replace with your image's original height

    let drawing = false;
    let currentShape = { name: '', points: [] };
    let shapes = [];

    // Add Shape Button Click
    addShapeBtn.addEventListener('click', () => {
        const shapeName = prompt('Enter shape name:');
        if (shapeName === null) {
            // User clicked 'Cancel', do not proceed with drawing
            return;
        }
        currentShape = { name: shapeName || 'no-name', points: [] };
        drawing = true;
        addShapeBtn.style.display = 'none';
        completeShapeBtn.style.display = 'inline-block';
        downloadJsonBtn.style.display = 'none';
    });

    // Complete Shape Button Click
    completeShapeBtn.addEventListener('click', () => {
        if (currentShape.points.length > 0) {
            shapes.push(currentShape);
            currentShape = { name: '', points: [] };
            drawing = false;
            addShapeBtn.style.display = 'inline-block';
            completeShapeBtn.style.display = 'none';
            updateJsonOutput();
            clearPoints();
        }
    });

    // Image Click Event
    image.addEventListener('click', (event) => {
        if (drawing) {
            const rect = image.getBoundingClientRect();
            const scaleX = originalImageWidth / rect.width;
            const scaleY = originalImageHeight / rect.height;

            const x = (event.clientX - rect.left) * scaleX;
            const y = (event.clientY - rect.top) * scaleY;

            currentShape.points.push({ x: x.toFixed(2), y: y.toFixed(2) });
            drawPoint(x, y);
        }
    });

    // Draw Point on Image
    function drawPoint(x, y) {
        const point = document.createElement('div');
        point.classList.add('point');
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        image.parentElement.appendChild(point);
    }

    // Clear Points from Image
    function clearPoints() {
        const points = document.querySelectorAll('.point');
        points.forEach(point => point.remove());
    }

    // Update JSON Output
    function updateJsonOutput() {
        jsonOutput.textContent = JSON.stringify(shapes, null, 2);
        downloadJsonBtn.style.display = 'inline-block';
    }

    // Download JSON Button Click
    downloadJsonBtn.addEventListener('click', () => {
        const jsonBlob = new Blob([JSON.stringify(shapes, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(jsonBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'shapes.json';
        a.click();
        URL.revokeObjectURL(url);
    });
});
