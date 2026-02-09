"use client";

import React, { useCallback, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Edge,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  Node,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  OnConnectEnd,
  OnConnectStart,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onConnectEnd?: OnConnectEnd;
  onConnectStart?: OnConnectStart;
  onPaneClick?: () => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
}

function GraphCanvasContent({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  onConnectStart,
  onPaneClick,
  setNodes,
  onNodeClick,
}: GraphCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const rawData = event.dataTransfer.getData('application/reactflow');
      let label = '';
      let type = 'default';
      let nodeStyle = {};
      let description = '';
      let descriptionSource: 'pdf' | 'ai' = 'ai';
      let level = 'concept';

      try {
        const parsed = JSON.parse(rawData);
        if (parsed && typeof parsed === 'object') {
          type = parsed.type || 'default';
          label = parsed.data?.label || 'Unknown Node';
          description = parsed.data?.description ?? '';
          descriptionSource = parsed.data?.descriptionSource === 'pdf' ? 'pdf' : 'ai';

          // Apply differentiated styling based on type
          switch (type) {
            case 'course':
              nodeStyle = {
                backgroundColor: '#333',
                color: '#fff',
                borderRadius: '12px',
                border: '2px solid #000',
                width: 180,
                fontSize: '16px',
                fontWeight: 'bold',
                padding: '10px',
              };
              level = 'course';
              break;
            case 'lecture':
              nodeStyle = {
                backgroundColor: '#f3f4f6',
                border: '1px solid #6b7280',
                borderRadius: '8px',
                padding: '10px',
                width: 160,
              };
              level = 'lecture';
              break;
            case 'module':
              nodeStyle = {
                border: '1px dashed #3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '4px',
                padding: '8px',
                width: 150,
                fontSize: '12px',
              };
              level = 'module';
              break;
            case 'concept':
              // Default style (white background, thin border)
              nodeStyle = {
                backgroundColor: '#fff',
                border: '1px solid #777',
                borderRadius: '3px',
                padding: '5px',
                width: 140,
                fontSize: '12px',
              };
              level = 'concept';
              break;
            default:
              // Fallback style
              break;
          }
        }
      } catch {
        label = rawData;
      }

      if (!label) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Generate unique ID
      const newNodeId = `dndnode_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

      const newNode: Node = {
        id: newNodeId,
        type: 'default', // Use 'default' for all nodes to ensure they have handles
        position,
        style: nodeStyle,
        data: { 
          label,
          level,
          description,
          descriptionSource,
          notes: '',
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [screenToFlowPosition, setNodes],
  );

  return (
    <div className="h-full w-full" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onConnectStart={onConnectStart}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasContent {...props} />
    </ReactFlowProvider>
  );
}
