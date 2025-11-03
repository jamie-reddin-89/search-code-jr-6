import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Home, ArrowLeft, FilePlus2, RefreshCw, Trash2 } from "lucide-react";
import TopRightControls from "@/components/TopRightControls";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ErrorInfo {
  id: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  error_code: string;
  meaning: string;
  solution: string;
  created_at?: string;
  created_by?: string | null;
}

export default function AdminAddErrorInfo() {
  const [list, setList] = useState<ErrorInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<Partial<ErrorInfo>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadErrorInfo();
  }, []);

  const loadErrorInfo = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("error_info")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setList(data || []);
    } catch (err) {
      console.error("Error loading error info:", err);
      toast({
        title: "Error loading data",
        description: "Failed to fetch from database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!form.error_code?.trim() || !form.meaning?.trim() || !form.solution?.trim()) {
      toast({
        title: "Missing required fields",
        description: "Error code, meaning, and solution are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase.from("error_info").insert({
        brand: form.brand || null,
        model: form.model || null,
        category: form.category || null,
        error_code: form.error_code,
        meaning: form.meaning,
        solution: form.solution,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Error info saved successfully" });
      setForm({});
      loadErrorInfo();
    } catch (err) {
      console.error("Error saving error info:", err);
      toast({
        title: "Error saving",
        description: (err as any)?.message || "Failed to save",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Delete this error info?")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("error_info").delete().eq("id", id);

      if (error) throw error;

      toast({ title: "Deleted successfully" });
      loadErrorInfo();
    } catch (err) {
      console.error("Error deleting:", err);
      toast({
        title: "Error deleting",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <TopRightControls />
      <header className="flex items-center justify-between mb-8 w-full max-w-xl">
        <div className="flex items-center gap-2">
          <Link to="/admin">
            <Button variant="ghost" size="icon" aria-label="Back to Admin">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="icon" aria-label="Go Home">
              <Home className="h-5 w-5" />
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FilePlus2 size={20} /> Add Error Info
        </h1>
        <div className="w-10" />
      </header>

      <div className="w-full max-w-xl grid gap-4">
        <div className="border rounded p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New Error Info</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={loadErrorInfo}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Brand</Label>
              <Input
                placeholder="Joule"
                value={form.brand || ""}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                disabled={loading}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Model</Label>
              <Input
                placeholder="Victorum"
                value={form.model || ""}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                disabled={loading}
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Category</Label>
              <Input
                placeholder="Heating"
                value={form.category || ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                disabled={loading}
                className="text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Error Code</Label>
            <Input
              placeholder="E001"
              value={form.error_code || ""}
              onChange={(e) => setForm({ ...form, error_code: e.target.value })}
              disabled={loading}
              className="text-sm font-mono"
            />
          </div>

          <div>
            <Label className="text-xs">Meaning</Label>
            <Textarea
              placeholder="Describe what this error code means..."
              value={form.meaning || ""}
              onChange={(e) => setForm({ ...form, meaning: e.target.value })}
              disabled={loading}
              className="text-sm h-20"
            />
          </div>

          <div>
            <Label className="text-xs">Solution</Label>
            <Textarea
              placeholder="How to fix this error..."
              value={form.solution || ""}
              onChange={(e) => setForm({ ...form, solution: e.target.value })}
              disabled={loading}
              className="text-sm h-20"
            />
          </div>

          <Button onClick={save} disabled={loading} className="w-full">
            <FilePlus2 className="h-4 w-4 mr-2" />
            Save Error Info
          </Button>
        </div>

        <div className="border rounded p-4 space-y-3">
          <h2 className="font-semibold">Latest Entries ({list.length})</h2>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {list.slice(0, 10).map((item) => (
                <div key={item.id} className="border rounded p-2 text-sm">
                  <div className="font-semibold font-mono text-base">
                    {item.error_code}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[item.brand, item.model, item.category]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                  <div className="mt-1">{item.meaning.substring(0, 80)}...</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Solution: {item.solution.substring(0, 60)}...
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteItem(item.id)}
                    disabled={loading}
                    className="mt-2"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
