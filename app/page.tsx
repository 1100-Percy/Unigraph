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
import { Save, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";

const initialNodes = [
  { id: '1', position: { x: 100, y: 100 }, data: { label: 'Node 1', notes: '' } },
  { id: '2', position: { x: 100, y: 200 }, data: { label: 'Node 2', notes: '' } },
];

const initialEdges = [{ id: 'e1-2', source: '1', target: '2', type: 'default' }];

const createEdgeId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
};

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
  const pendingEdgeId = useRef<string | null>(null);
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
      let clientX: number | null = null;
      let clientY: number | null = null;

      if ('clientX' in event) {
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        const touch = event.changedTouches?.[0] ?? event.touches?.[0] ?? null;
        if (touch) {
          clientX = touch.clientX;
          clientY = touch.clientY;
        }
      }

      if (clientX === null || clientY === null) {
        return;
      }
      
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
      const edgeId = createEdgeId();
      pendingEdgeId.current = edgeId;

      const defaultConfig = EDGE_TYPES.PREREQUISITE;
      setEdges((eds) =>
        addEdge(
          {
            id: edgeId,
            ...params,
            type: 'default',
            style: defaultConfig.style,
            markerEnd: defaultConfig.markerEnd ? { ...defaultConfig.markerEnd } : undefined,
            animated: false,
          },
          eds,
        ),
      );
      
      // Try to open menu (in case onConnectEnd fired first)
      tryOpenMenu();
    },
    [setEdges, tryOpenMenu],
  );

  const handleEdgeTypeSelect = (type: EdgeTypeKey) => {
    const config = EDGE_TYPES[type];
    const edgeId = pendingEdgeId.current;

    if (edgeId) {
      setEdges((eds) =>
        eds.map((edge) =>
          edge.id === edgeId
            ? {
                ...edge,
                type: 'default',
                style: config.style,
                markerEnd: config.markerEnd ? { ...config.markerEnd } : undefined,
                animated: type === 'COMPLEMENTARY',
              }
            : edge,
        ),
      );
    } else if (pendingConnection.current) {
      const fallbackId = createEdgeId();
      setEdges((eds) =>
        addEdge(
          {
            id: fallbackId,
            ...pendingConnection.current!,
            type: 'default',
            style: config.style,
            markerEnd: config.markerEnd ? { ...config.markerEnd } : undefined,
            animated: type === 'COMPLEMENTARY',
          },
          eds,
        ),
      );
    }
    
    // Reset state
    setMenuState((prev) => ({ ...prev, isOpen: false }));
    pendingConnection.current = null;
    pendingEdgeId.current = null;
    lastMousePosition.current = null;
  };

  const closeMenu = () => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
    pendingConnection.current = null;
    pendingEdgeId.current = null;
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
        <div className="min-h-screen w-full bg-[#F2EDE4] flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-[#F2EDE4] border rounded-xl p-8 shadow-sm">
            <h1 className="text-3xl font-bold text-[#402722]">Unigraph</h1>
            <p className="mt-3 text-[#402722]">
              Upload lecture PDFs and build your knowledge graph.
            </p>
            <div className="mt-6">
              <SignInButton mode="redirect" forceRedirectUrl="/">
                <Button className="w-full">Get Started</Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <div className="flex h-screen w-full overflow-hidden">
          <div
            className={`shrink-0 transition-[width] duration-200 ${
              isSidebarCollapsed ? "w-0 overflow-hidden pointer-events-none" : "w-80"
            }`}
            aria-hidden={isSidebarCollapsed}
          >
            <Sidebar onCollapse={() => setIsSidebarCollapsed(true)} />
          </div>

          <main className="flex-1 bg-[#F2EDE4] relative">
            {isSidebarCollapsed && (
              <div className="absolute top-4 left-4 z-10">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsSidebarCollapsed(false)}
                  aria-label="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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
