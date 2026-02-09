"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Node,
} from "reactflow";
import GraphCanvas from "@/components/GraphCanvas";
import Sidebar from "@/components/Sidebar";
import ConnectionMenu from "@/components/ConnectionMenu";
import InspectorPanel from "@/components/InspectorPanel";
import { EDGE_TYPES, EdgeTypeKey } from "@/lib/edge-types";
import { Button } from "@/components/ui/button";
import { Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

const initialNodes = [
  { id: '1', position: { x: 100, y: 100 }, data: { label: 'Node 1', notes: '' } },
  { id: '2', position: { x: 100, y: 200 }, data: { label: 'Node 2', notes: '' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2', type: 'default' }];

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Load graph data on mount
  useEffect(() => {
    const loadGraph = async () => {
      try {
        const response = await fetch('/api/graph/load');
        if (!response.ok) {
          throw new Error('Failed to load graph');
        }
        
        const data = await response.json();
        
        // Only update if we have data, otherwise keep initial state
        if (data.nodes && data.nodes.length > 0) {
          setNodes(data.nodes);
        }
        
        if (data.edges && data.edges.length > 0) {
          setEdges(data.edges);
        }
        
        if (data.nodes && data.nodes.length > 0) {
           toast.success('Graph loaded successfully');
        }
      } catch (error) {
        console.error('Failed to load graph:', error);
        toast.error('Failed to load graph data');
      }
    };

    loadGraph();
  }, [setNodes, setEdges]);

  // Connection Menu State
  const [menuState, setMenuState] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  
  // Store the pending connection params
  const pendingConnection = useRef<Connection | null>(null);
  // Store the last mouse up position
  const lastMousePosition = useRef<{ x: number; y: number } | null>(null);

  // Helper to try opening the menu if both conditions are met
  const tryOpenMenu = useCallback(() => {
    if (pendingConnection.current && lastMousePosition.current) {
      setMenuState({
        isOpen: true,
        position: lastMousePosition.current,
      });
    }
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Store the position
      const clientX = 'clientX' in event ? event.clientX : event.touches[0].clientX;
      const clientY = 'clientY' in event ? event.clientY : event.touches[0].clientY;
      
      lastMousePosition.current = { x: clientX, y: clientY };
      
      // Try to open menu (in case onConnect fired first)
      tryOpenMenu();
    },
    [tryOpenMenu]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      // Store the connection params
      pendingConnection.current = params;
      
      // Try to open menu (in case onConnectEnd fired first)
      tryOpenMenu();
    },
    [tryOpenMenu],
  );

  const handleEdgeTypeSelect = (type: EdgeTypeKey) => {
    if (pendingConnection.current) {
      const config = EDGE_TYPES[type];
      setEdges((eds) => addEdge({
        ...pendingConnection.current!,
        type: 'default', // Keep standard edge type but apply styles
        style: config.style,
        markerEnd: config.markerEnd ? { ...config.markerEnd } : undefined, // Clone marker config
        animated: type === 'COMPLEMENTARY', // Optional: animate dashed lines
      }, eds));
    }
    
    // Reset state
    setMenuState((prev) => ({ ...prev, isOpen: false }));
    pendingConnection.current = null;
    lastMousePosition.current = null;
  };

  const closeMenu = () => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
    pendingConnection.current = null;
    lastMousePosition.current = null;
  };

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const updateNodeNotes = (notes: string) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, notes } }
          : node
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/graph/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nodes, edges }),
      });

      if (!response.ok) {
        throw new Error('Failed to save');
      }

      toast.success('Graph saved successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save graph');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <SignedOut>
        <div className="min-h-screen w-full bg-[#fdfbf7] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white border rounded-xl p-8 shadow-sm">
            <h1 className="text-3xl font-bold text-slate-900">Unigraph</h1>
            <p className="mt-3 text-slate-600">
              Upload lecture PDFs and build your knowledge graph.
            </p>
            <div className="mt-6">
              <SignInButton mode="redirect" forceRedirectUrl="/">
                <Button className="w-full">开始使用</Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />

          <main className="flex-1 bg-[#fdfbf7] relative">
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onPaneClick={() => setSelectedNodeId(null)}
              setNodes={setNodes}
              onNodeClick={onNodeClick}
            />

            <div className="absolute top-4 right-4 z-10">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
            </div>

            {menuState.isOpen && (
              <ConnectionMenu
                position={menuState.position}
                onSelect={handleEdgeTypeSelect}
                onClose={closeMenu}
              />
            )}
          </main>

          <InspectorPanel
            selectedNode={selectedNode || null}
            onClose={() => setSelectedNodeId(null)}
            onNotesChange={updateNodeNotes}
          />
        </div>
      </SignedIn>
    </>
  );
}
