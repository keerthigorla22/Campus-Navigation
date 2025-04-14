/// <reference types="leaflet" />

var map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -100,
    maxZoom: 1,
    attributionControl : false
});

let allMapData = {}; // To store map data for all floors
let currentFloor = null;
let mapRooms = [], mapNodes = [], mapEdges = [];
let routeLayer = null;
let sourceCentroidMarker; // To store the source centroid marker
let destCentroidMarker;   // To store the destination centroid marker
let sourceParallelMarker; // To store the source parallel point marker
let destParallelMarker;   // To store the destination parallel point marker

async function loadMapData() {
    try {
        const floorNames = ["ABC Ground Floor.json", "ABC Second Floor.json"]; // Simulate loading multiple files
        for (const floorFile of floorNames) {
            const response = await fetch(floorFile);
            const json = await response.json();
            const floorplanName = json.name || "Floorplan";
            allMapData[floorplanName] = json;
        }

        // Set the initial floor to the first one loaded (e.g., Ground Floor)
        const firstFloorName = Object.keys(allMapData)[0];
        if (firstFloorName) {
            currentFloor = firstFloorName;
            const currentFloorData = allMapData[currentFloor];
            mapRooms = currentFloorData.rooms || [];
            mapNodes = currentFloorData.nodes || [];
            mapEdges = currentFloorData.edges || [];
            drawRooms(mapRooms, mapNodes, currentFloor);
            updateFloorSelector();
        }

        addEnterKeyListener();

        return { rooms: mapRooms, nodes: mapNodes, edges: mapEdges };
    } catch (err) {
        console.error("Failed to load JSON : ", err);
    }
}
loadMapData();

function updateFloorSelector() {
    const floorSelector = document.getElementById('floor-selector');
    if (floorSelector) {
        floorSelector.innerHTML = ''; // Clear previous options
        for (const floorName in allMapData) {
            const option = document.createElement('option');
            option.value = floorName;
            option.textContent = floorName;
            if (floorName === currentFloor) {
                option.selected = true;
            }
            floorSelector.appendChild(option);
        }
        floorSelector.onchange = switchFloor;
    } else {
        console.log("floor-selector element NOT found.");
    }
}

function switchFloor() {
    const floorSelector = document.getElementById('floor-selector');
    if (floorSelector) {
        const selectedFloor = floorSelector.value;
        if (selectedFloor && allMapData[selectedFloor]) {
            currentFloor = selectedFloor;
            const currentFloorData = allMapData[currentFloor];
            mapRooms = currentFloorData.rooms || [];
            mapNodes = currentFloorData.nodes || [];
            mapEdges = currentFloorData.edges || [];
            redrawMap(mapRooms, mapNodes, currentFloor);
        }
    }
}

function drawRooms(rooms, nodes, floorplanName) {
    map.eachLayer(function (layer) {
        if (!(layer instanceof L.TileLayer)) { // Keep the base tile layer if any
            map.removeLayer(layer);
        }
    });

    const allpoints = [];
    const entranceIcon = L.divIcon({
        className: 'entrance-icon',
        html: '<svg style="width:24px;height:24px;" viewBox="0 0 24 24"><path fill="currentColor" d="M13 13V17H11V13H13M13 9V11H11V9H13M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2M12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20M12 6C10.9 6 10 6.9 10 8C10 9.1 10.9 10 12 10C13.1 10 14 9.1 14 8C14 6.9 13.1 6 12 6Z" /></svg>', // Example SVG for an entrance
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    rooms.forEach((room) => {
        const converted = room.coordinates.map((point) => [point.x, point.y]);
        allpoints.push(...converted);
        let polygonColor = 'green';
        let isEntrance = false;

        if (room.alias && room.alias.some(alias => alias.toLowerCase() === "entrance")) {
            isEntrance = true;
            polygonColor = 'lightgreen'; // Or any other distinct color
            // Optionally, you could add a marker on the centroid here as well
        } else if (room.name && room.name.toLowerCase().includes("entrance")) {
            isEntrance = true;
            polygonColor = 'lightgreen';
        }

        const polygon = L.polygon(converted, { color: polygonColor , weight: 1.3 }).addTo(map);
        polygon.bindPopup(room.name || "Unnamed Room");

        // Calculate centroid for label position
        let centroidX = 0;
        let centroidY = 0;
        room.coordinates.forEach(coord => {
            centroidX += coord.x;
            centroidY += coord.y;
        });
        centroidX /= room.coordinates.length;
        centroidY /= room.coordinates.length;

        // Create a label with adjusted styling
        const label = L.divIcon({
            className: 'room-label',
            html: `<div style="font-size: 12px; color: #333; background-color: rgba(255, 255, 255, 0.23); padding: 3px 10px; border: 0px solid #999; border-radius: 10px; text-align: center;">${room.name}</div>`,
            iconSize: [80, 20], // Adjust size as needed
            iconAnchor: [40, 10] // Center the label
        });

        // Add the label to the map
        L.marker([centroidX, centroidY], { icon: label }).addTo(map);

        if (isEntrance) {
            L.marker([centroidX, centroidY], { icon: entranceIcon }).addTo(map);
        }
    });

    nodes.forEach(node => {
        let isEntrance = false;
        if (node.alias && node.alias.some(alias => alias.toLowerCase() === "entrance")) {
            isEntrance = true;
        } else if (node.name && node.name.toLowerCase().includes("entrance")) {
            isEntrance = true;
        }
        if (isEntrance && node.coordinates) {
            L.marker([node.coordinates.x, node.coordinates.y], { icon: entranceIcon }).addTo(map);
        }
    });

    if (allpoints.length) {
        const bounds = L.latLngBounds(allpoints)
        map.fitBounds(bounds);
    } else {
        // Set a default view if no rooms are loaded
        map.setView([0, 0], 0);
    }

    // Display Floorplan Name
    const mapTitleDiv = document.getElementById('map-title');
    const floorplanNameInstructionSpan = document.getElementById('floorplan-name-instruction');
    if (mapTitleDiv && floorplanNameInstructionSpan) {
        // Simple formatting: capitalize each word
        const formattedName = floorplanName.split(/[\s_-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
        mapTitleDiv.textContent = `${formattedName} Map`;
        floorplanNameInstructionSpan.textContent = formattedName;
    }
}

function addEnterKeyListener() {
    const sourceInput = document.getElementById("sourceRoomInput");
    const destinationInput = document.getElementById("destinationRoomInput");
    const goButton = document.querySelector('.controls button'); // Assuming the "Go" button is the one to trigger

    if (sourceInput) {
        sourceInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (goButton) {
                    goButton.click();
                }
            }
        });
    }

    if (destinationInput) {
        destinationInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (goButton) {
                    goButton.click();
                }
            }
        });
    }
}

function getMapCenter(rooms) {
    let totalX = 0;
    let totalY = 0;
    let totalPoints = 0;
    rooms.forEach(room => {
        room.coordinates.forEach(coord => {
            totalX += coord.x;
            totalY += coord.y;
            totalPoints++;
        });
    });
    return { x: totalX / totalPoints, y: totalY / totalPoints };
}

function rotatePoint(point, center, angleRad) {
    const s = Math.sin(angleRad);
    const c = Math.cos(angleRad);

    // Translate point back to origin
    const px = point.x - center.x;
    const py = point.y - center.y;

    // Rotate point
    const newX = px * c - py * s;
    const newY = px * s + py * c;

    // Translate point back
    return { x: newX + center.x, y: newY + center.y };
}

function rotateMap(angleDegrees) {
    if (!allMapData[currentFloor]) return;

    const angleRad = angleDegrees * Math.PI / 180;
    const center = getMapCenter(allMapData[currentFloor].rooms);
    const currentMapData = allMapData[currentFloor];

    // Create deep copies to avoid modifying the original data directly
    const rotatedRooms = currentMapData.rooms.map(room => ({
        ...room,
        coordinates: room.coordinates.map(coord => rotatePoint(coord, center, angleRad))
    }));

    const rotatedNodes = currentMapData.nodes.map(node => ({
        ...node,
        coordinates: node.coordinates ? rotatePoint(node.coordinates, center, angleRad) : null
    }));

    const rotatedEdges = currentMapData.edges.map(edge => ({
        ...edge
    }));

    allMapData[currentFloor] = { ...currentMapData, rooms: rotatedRooms, nodes: rotatedNodes, edges: rotatedEdges };
    mapRooms = rotatedRooms;
    mapNodes = rotatedNodes;
    mapEdges = rotatedEdges;

    redrawMap(mapRooms, mapNodes, currentFloor);
}

function rotateLeft() {
    rotateMap(-90);
}

function rotateRight() {
    rotateMap(90);
}

function redrawMap(roomsToDraw, nodesToDraw, floorName) {
    map.eachLayer(function (layer) {
        if (!(layer instanceof L.TileLayer)) {
            map.removeLayer(layer);
        }
    });
    drawRooms(roomsToDraw, nodesToDraw, floorName);
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
        if (sourceCentroidMarker) map.removeLayer(sourceCentroidMarker);
        if (destCentroidMarker) map.removeLayer(destCentroidMarker);
        if (sourceParallelMarker) map.removeLayer(sourceParallelMarker);
        if (destParallelMarker) map.removeLayer(destParallelMarker);
    }
}

function distanceSq(p1, p2) {
    return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function pointToSegmentDistanceSq(point, a, b) {
    const l2 = distanceSq(a, b);
    if (l2 === 0) return distanceSq(point, a);
    let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return distanceSq(point, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

function pointToSegmentDistance(point, a, b) {
    return Math.sqrt(pointToSegmentDistanceSq(point, a, b));
}

let sourceNearestNodes;
let destNearestNodes;
let sourceParallelPoint;
let destParallelPoint;
let nearest1ResultGlobal;
let nearest2ResultGlobal;

function normalizeRoomName(name) {
    if (!name) return "";
    const parts = name.split('('); // Split by '(' to potentially isolate the room name
    const baseName = parts[0].trim(); // Take the part before '(' and trim whitespace
    return baseName.toUpperCase().replace(/[\s-]/g, ''); // Convert to uppercase and remove spaces and hyphens
}

function findPoint(sourceRoomName, destRoomName) {
    // Remove previous markers if they exist
    if (sourceCentroidMarker) {
        map.removeLayer(sourceCentroidMarker);
    }
    if (destCentroidMarker) {
        map.removeLayer(destCentroidMarker);
    }
    if (sourceParallelMarker) {
        map.removeLayer(sourceParallelMarker);
    }
    if (destParallelMarker) {
        map.removeLayer(destParallelMarker);
    }

    const sourceFloor = Object.keys(allMapData).find(floorName => {
        const normalizedSourceName = normalizeRoomName(sourceRoomName).toUpperCase();
        const floorData = allMapData[floorName];
        return floorData && (
            floorData.rooms.some(room => normalizeRoomName(room.name).toUpperCase() === normalizedSourceName || (room.alias && Array.isArray(room.alias) && room.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedSourceName))) ||
            floorData.nodes.some(node => normalizeRoomName(node.name).toUpperCase() === normalizedSourceName || (node.alias && Array.isArray(node.alias) && node.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedSourceName)))
        );
    });

    const destFloor = Object.keys(allMapData).find(floorName => {
        const normalizedDestName = normalizeRoomName(destRoomName).toUpperCase();
        const floorData = allMapData[floorName];
        return floorData && (
            floorData.rooms.some(room => normalizeRoomName(room.name).toUpperCase() === normalizedDestName || (room.alias && Array.isArray(room.alias) && room.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedDestName))) ||
            floorData.nodes.some(node => normalizeRoomName(node.name).toUpperCase() === normalizedDestName || (node.alias && Array.isArray(node.alias) && node.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedDestName)))
        );
    });

    if (!sourceFloor || !destFloor) {
        alert("Source or Destination room not found in the loaded floor plans.");
        return;
    }

    if (sourceFloor !== currentFloor) {
        alert(`Source room "${sourceRoomName}" is on floor: ${sourceFloor}. Please switch to that floor to visualize the start.`);
    }
    if (destFloor !== currentFloor) {
        alert(`Destination room "${destRoomName}" is on floor: ${destFloor}. Please switch to that floor to visualize the end.`);
    }

    const findRoomOrNodeOnFloor = (nameToFind, floorData) => {
        const normalizedName = normalizeRoomName(nameToFind).toUpperCase();
        let foundItem = null;

        // Check in rooms
        for (const item of floorData.rooms) {
            if (normalizeRoomName(item.name).toUpperCase() === normalizedName || (item.alias && Array.isArray(item.alias) && item.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedName))) {
                foundItem = { type: 'room', data: item };
                return foundItem;
            }
        }

        // Check in nodes if not found in rooms
        for (const item of floorData.nodes) {
            if (normalizeRoomName(item.name).toUpperCase() === normalizedName || (item.alias && Array.isArray(item.alias) && item.alias.some(alias => normalizeRoomName(alias).toUpperCase() === normalizedName))) {
                foundItem = { type: 'node', data: item };
                return foundItem;
            }
        }

        return null;
    };

    const currentFloorData = allMapData[currentFloor];
    const sourceResult = findRoomOrNodeOnFloor(sourceRoomName, currentFloorData);
    const destResult = findRoomOrNodeOnFloor(destRoomName, currentFloorData);

    let sRoom = null;
    let dRoom = null;
    let sNode = null;
    let dNode = null;

    if (sourceResult) {
        if (sourceResult.type === 'room') {
            sRoom = sourceResult.data;
        } else if (sourceResult.type === 'node') {
            sNode = sourceResult.data;
        }
    }

    if (destResult) {
        if (destResult.type === 'room') {
            dRoom = destResult.data;
        } else if (destResult.type === 'node') {
            dNode = destResult.data;
        }
    }

    // console.log("Source:", sourceResult, "Destination:", destResult);

    if (!sourceResult || !destResult) {
        alert("Source or Destination room not found on the current floor!");
        return;
    }

    let centroid1;
    if (sRoom) {
        centroid1 = sRoom.coordinates.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
        centroid1.x /= sRoom.coordinates.length;
        centroid1.y /= sRoom.coordinates.length;
    } else if (sNode && sNode.coordinates) {
        centroid1 = sNode.coordinates;
    }

    let centroid2;
    if (dRoom) {
        centroid2 = dRoom.coordinates.reduce((acc, point) => {
            acc.x += point.x;
            acc.y += point.y;
            return acc;
        }, { x: 0, y: 0 });
        centroid2.x /= dRoom.coordinates.length;
        centroid2.y /= dRoom.coordinates.length;
    } else if (dNode && dNode.coordinates) {
        centroid2 = dNode.coordinates;
    }

    // Define custom icons
    const sourceIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    const destinationIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    if (centroid1) {
        sourceCentroidMarker = L.marker([centroid1.x, centroid1.y], { icon: sourceIcon }).addTo(map);
    }

    if (centroid2) {
        destCentroidMarker = L.marker([centroid2.x, centroid2.y], { icon: destinationIcon }).addTo(map);
    }

    const currentFloorEdges = currentFloorData.edges || [];
    const currentFloorNodes = currentFloorData.nodes || [];

    const findNearestEdgeAndParallelPoint = (centroid, edges, nodes) => {
        let nearestEdge = null;
        let minDistance = Infinity;
        let parallelPoint = null;
        let nearestNodes = null;

        edges.forEach((edge) => {
            const nodeA = nodes.find(n => n.id === edge.sourceNodeId);
            const nodeB = nodes.find(n => n.id === edge.targetNodeId);
            if (!nodeA || !nodeB || !nodeA.coordinates || !nodeB.coordinates) return;

            const pointA = nodeA.coordinates;
            const pointB = nodeB.coordinates;

            const dist = pointToSegmentDistance(centroid, pointA, pointB);

            if (dist < minDistance) {
                minDistance = dist;
                nearestEdge = edge;
                nearestNodes = { source: nodeA, target: nodeB };

                const isHorizontal = Math.abs(pointA.y - pointB.y) < 1e-6;
                const isVertical = Math.abs(pointA.x - pointB.x) < 1e-6;

                if (isHorizontal) {
                    if (centroid.x >= Math.min(pointA.x, pointB.x) && centroid.x <= Math.max(pointA.x, pointB.x)) {
                        parallelPoint = { x: centroid.x, y: pointA.y };
                    } else if (Math.abs(centroid.x - pointA.x) < Math.abs(centroid.x - pointB.x)) {
                        parallelPoint = { x: pointA.x, y: pointA.y };
                    } else {
                        parallelPoint = { x: pointB.x, y: pointB.y };
                    }
                } else if (isVertical) {
                    if (centroid.y >= Math.min(pointA.y, pointB.y) && centroid.y <= Math.max(pointA.y, pointB.y)) {
                        parallelPoint = { x: pointA.x, y: centroid.y };
                    } else if (Math.abs(centroid.y - pointA.y) < Math.abs(centroid.y - pointB.y)) {
                        parallelPoint = { x: pointA.x, y: pointA.y };
                    } else {
                        parallelPoint = { x: pointB.x, y: pointB.y };
                    }
                } else {
                    const l2 = distanceSq(pointA, pointB);
                    if (l2 !== 0) {
                        let t = ((centroid.x - pointA.x) * (pointB.x - pointA.x) + (centroid.y - pointA.y) * (pointB.y - pointA.y)) / l2;
                        t = Math.max(0, Math.min(1, t));
                        parallelPoint = { x: pointA.x + t * (pointB.x - pointA.x), y: pointA.y + t * (pointB.y - pointA.y) };
                    } else {
                        parallelPoint = pointA;
                    }
                }
            }
        });
        return { edge: nearestEdge, distance: minDistance, parallelPoint: parallelPoint, nodes: nearestNodes };
    };

    if (centroid1) {
        nearest1ResultGlobal = findNearestEdgeAndParallelPoint(centroid1, currentFloorEdges, currentFloorNodes);
        if (nearest1ResultGlobal.edge && nearest1ResultGlobal.nodes && nearest1ResultGlobal.parallelPoint) {
            sourceParallelMarker = L.circleMarker([nearest1ResultGlobal.parallelPoint.x, nearest1ResultGlobal.parallelPoint.y], {
                radius: 4,
                color: 'lime',
                fillOpacity: 1
            }).addTo(map);
            sourceNearestNodes = nearest1ResultGlobal.nodes;
            sourceParallelPoint = nearest1ResultGlobal.parallelPoint;
        }
    }

    if (centroid2) {
        nearest2ResultGlobal = findNearestEdgeAndParallelPoint(centroid2, currentFloorEdges, currentFloorNodes);
        if (nearest2ResultGlobal.edge && nearest2ResultGlobal.nodes && nearest2ResultGlobal.parallelPoint) {
            destParallelMarker = L.circleMarker([nearest2ResultGlobal.parallelPoint.x, nearest2ResultGlobal.parallelPoint.y], {
                radius: 4,
                color: 'cyan',
                fillOpacity: 1
            }).addTo(map);
            destNearestNodes = nearest2ResultGlobal.nodes;
            destParallelPoint = nearest2ResultGlobal.parallelPoint;
        }
    }

    if (nearest1ResultGlobal && nearest2ResultGlobal && nearest1ResultGlobal.parallelPoint && nearest2ResultGlobal.parallelPoint && currentFloorNodes && currentFloorEdges) {
        findShortestPathBetweenParallelPoints(currentFloorNodes, currentFloorEdges, nearest1ResultGlobal, nearest2ResultGlobal);
    }
}

function distance(p1, p2) {
    return Math.sqrt(distanceSq(p1, p2));
}

function findNearestNode(nodes, point) {
    let nearestNode = null;
    let minDistance = Infinity;

    for (const node of nodes) {
        if (node.coordinates) {
            const dist = distanceSq(point, node.coordinates);
            if (dist < minDistance) {
                minDistance = dist;
                nearestNode = node;
            }
        }
    }
    return nearestNode;
}

function findShortestPathBetweenParallelPoints(allNodes, allEdges, startNearestResult, endNearestResult) {
    const nodes = [...allNodes];
    const edges = [...allEdges];
    const startPoint = startNearestResult.parallelPoint;
    const endPoint = endNearestResult.parallelPoint;

    // Use the nodes of the nearest edge as potential starting/ending points
    const potentialStartNodes = [
        nodes.find(n => n.id === startNearestResult.nodes.source.id),
        nodes.find(n => n.id === startNearestResult.nodes.target.id)
    ].filter(Boolean);

    const potentialEndNodes = [
        nodes.find(n => n.id === endNearestResult.nodes.source.id),
        nodes.find(n => n.id === endNearestResult.nodes.target.id)
    ].filter(Boolean);

    let shortestPath = null;
    let minPathLength = Infinity;
    let bestStartNode = null;
    let bestEndNode = null;

    for (const startNode of potentialStartNodes) {
        for (const endNode of potentialEndNodes) {
            const adjacencyList = {};
            for (const node of nodes) {
                adjacencyList[node.id] = [];
            }

            for (const edge of edges) {
                const sourceId = edge.sourceNodeId;
                const targetId = edge.targetNodeId;
                const source = nodes.find(n => n.id === sourceId);
                const target = nodes.find(n => n.id === targetId);
                if (source && target && source.coordinates && target.coordinates) {
                    const weight = edge.weight !== undefined ? edge.weight : distance(source.coordinates, target.coordinates);
                    adjacencyList[sourceId].push({ node: targetId, weight: weight });
                    adjacencyList[targetId].push({ node: sourceId, weight: weight }); // Assuming undirected graph
                }
            }

            const distances = {};
            const predecessors = {};
            const priorityQueue = [];

            for (const node of nodes) {
                distances[node.id] = Infinity;
                predecessors[node.id] = null;
            }

            distances[startNode.id] = 0;
            priorityQueue.push({ node: startNode.id, distance: 0 });
            priorityQueue.sort((a, b) => a.distance - b.distance);

            while (priorityQueue.length > 0) {
                const current = priorityQueue.shift();
                const currentNodeId = current.node;
                const currentDistance = current.distance;

                if (currentDistance > distances[currentNodeId]) {
                    continue;
                }

                if (currentNodeId === endNode.id) {
                    break;
                }

                if (!adjacencyList[currentNodeId]) continue;

                for (const neighborInfo of adjacencyList[currentNodeId]) {
                    const neighborId = neighborInfo.node;
                    const weight = neighborInfo.weight;
                    const newDistance = distances[currentNodeId] + weight;

                    if (newDistance < distances[neighborId]) {
                        distances[neighborId] = newDistance;
                        predecessors[neighborId] = currentNodeId;
                        priorityQueue.push({ node: neighborId, distance: newDistance });
                        priorityQueue.sort((a, b) => a.distance - b.distance);
                    }
                }
            }

            if (distances[endNode.id] !== Infinity) {
                let currentId = endNode.id;
                const currentPathNodes = [];
                while (currentId && currentId !== startNode.id) {
                    currentPathNodes.unshift(currentId);
                    currentId = predecessors[currentId];
                }
                if (currentId === startNode.id) {
                    currentPathNodes.unshift(currentId);
                    const currentPathLength = distances[endNode.id] + distance(startPoint, startNode.coordinates) + distance(endPoint, endNode.coordinates);
                    if (currentPathLength < minPathLength) {
                        minPathLength = currentPathLength;
                        shortestPath = currentPathNodes;
                        bestStartNode = startNode;
                        bestEndNode = endNode;
                    }
                }
            }
        }
    }

    if (shortestPath && bestStartNode && bestEndNode) {
        // console.log("Shortest Path Nodes between parallel points:", shortestPath);
        drawPathFromParallelPoints(startPoint, shortestPath, endPoint, nodes, bestStartNode, bestEndNode);
    } else {
        console.log("No path found between the nearest edge nodes.");
    }
}

function drawPathFromParallelPoints(startPoint, pathNodes, endPoint, allNodes, startNode, endNode) {
    if (!pathNodes) {
        console.log("No path to draw.");
        return;
    }

    if (routeLayer) {
        map.removeLayer(routeLayer);
    }

    const pathCoordinates = [];
    pathCoordinates.push([startPoint.x, startPoint.y]);
    pathCoordinates.push([startNode.coordinates.x, startNode.coordinates.y]);

    for (const nodeId of pathNodes) {
        const node = allNodes.find(n => n.id === nodeId);
        if (node && node.coordinates) {
            pathCoordinates.push([node.coordinates.x, node.coordinates.y]);
        }
    }

    pathCoordinates.push([endNode.coordinates.x, endNode.coordinates.y]);
    pathCoordinates.push([endPoint.x, endPoint.y]);

    if (pathCoordinates.length > 1) {
        routeLayer = L.polyline(pathCoordinates, { color: 'red', weight: 5 }).addTo(map);
        // .bindPopup("Shortest Path");
    } else {
        console.log("Not enough coordinates to draw the path.");
    }
}

function handleGo() {
    const sourceRoomName = document.getElementById("sourceRoomInput").value.trim();
    const destRoomName = document.getElementById("destinationRoomInput").value.trim();

    if (!sourceRoomName || !destRoomName) {
        alert("Please enter both source and destination room names.");
        return;
    }

    findPoint(sourceRoomName, destRoomName);
}

// Add a floor selector to the HTML
document.addEventListener('DOMContentLoaded', function() {
    const controlsDiv = document.querySelector('.controls');
    if (controlsDiv) {
        const floorSelector = document.createElement('select');
        floorSelector.id = 'floor-selector';
        controlsDiv.prepend(floorSelector); // Add it at the beginning of the controls
    }
});