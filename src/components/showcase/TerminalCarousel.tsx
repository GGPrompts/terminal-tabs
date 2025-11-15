import { useState, useRef, useEffect } from 'react';
import { Terminal as ITerminal } from '@/stores/simpleTerminalStore';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AvatarIcon } from '@/components/ui/avatar-icon';
import Autoplay from 'embla-carousel-autoplay';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Rocket } from 'lucide-react';

interface TerminalCarouselProps {
  terminals: ITerminal[];
  activeTerminalId: string | null;
  onTerminalSelect: (terminalId: string) => void;
  terminalRefs?: Map<string, HTMLDivElement>; // Container refs to get canvas
}

export function TerminalCarousel({
  terminals,
  activeTerminalId,
  onTerminalSelect,
  terminalRefs,
}: TerminalCarouselProps) {
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map());
  const plugin = useRef(Autoplay({ delay: 3000, stopOnInteraction: true }));

  // Debug logging for carousel rendering
  useEffect(() => {
    console.log('[Carousel] Rendering with terminals:', terminals.length);
    console.log('[Carousel] Active ID:', activeTerminalId);
  }, [terminals, activeTerminalId]);

  // Generate thumbnail from xterm.js canvas
  const generateThumbnail = (terminalId: string): string | null => {
    if (!terminalRefs) return null;
    
    const container = terminalRefs.get(terminalId);
    if (!container) return null;

    // Find the xterm.js canvas
    const canvas = container.querySelector('canvas.xterm-screen-canvas') as HTMLCanvasElement;
    if (!canvas) return null;

    try {
      // Create a thumbnail canvas
      const thumbnail = document.createElement('canvas');
      thumbnail.width = 400;
      thumbnail.height = 250;
      const ctx = thumbnail.getContext('2d');
      
      if (!ctx) return null;

      // Draw the terminal canvas scaled down
      ctx.drawImage(canvas, 0, 0, thumbnail.width, thumbnail.height);

      return thumbnail.toDataURL('image/png', 0.8);
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return null;
    }
  };

  // Update thumbnails periodically
  useEffect(() => {
    const updateThumbnails = () => {
      const newThumbnails = new Map<string, string>();
      
      terminals.forEach((terminal) => {
        if (terminal.status === 'active' || terminal.status === 'spawning') {
          const thumbnail = generateThumbnail(terminal.id);
          if (thumbnail) {
            newThumbnails.set(terminal.id, thumbnail);
          }
        }
      });

      setThumbnails(newThumbnails);
    };

    // Initial generation
    updateThumbnails();

    // Update every 5 seconds for live thumbnails
    const interval = setInterval(updateThumbnails, 5000);

    return () => clearInterval(interval);
  }, [terminals, terminalRefs]);

  // Filter out hidden terminals (e.g., split panes)
  const visibleTerminals = terminals.filter((t) => !t.isHidden);

  if (visibleTerminals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <Rocket className="w-16 h-16 mx-auto mb-4 text-primary" />
          <p>No terminals yet. Spawn one to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-8">
      <Carousel
        plugins={[plugin.current]}
        className="w-full max-w-5xl mx-auto"
        onMouseEnter={plugin.current.stop}
        onMouseLeave={plugin.current.reset}
        opts={{
          align: 'start',
          loop: true,
        }}
      >
        <CarouselContent className="-ml-2 md:-ml-4 py-4">
          {visibleTerminals.map((terminal) => {
            const isActive = terminal.id === activeTerminalId;
            const thumbnail = thumbnails.get(terminal.id);

            return (
              <CarouselItem
                key={terminal.id}
                className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3 px-2"
              >
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Card
                      className={cn(
                        'cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl mx-1',
                        isActive && 'ring-2 ring-primary shadow-lg'
                      )}
                      onClick={() => onTerminalSelect(terminal.id)}
                    >
                      <CardContent className="p-4">
                        <div className="relative rounded-lg overflow-hidden bg-muted">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={terminal.name}
                              className="w-full h-40 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-40 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                              <div className="flex flex-col items-center gap-3">
                                <AvatarIcon
                                  terminalType={terminal.terminalType}
                                  size="xl"
                                />
                                <p className="text-sm text-muted-foreground">
                                  {terminal.status === 'spawning' ? 'Starting...' : 'No preview'}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Status badge */}
                          <Badge
                            className="absolute top-2 right-2"
                            variant={
                              terminal.status === 'active'
                                ? 'default'
                                : terminal.status === 'spawning'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {terminal.status || 'active'}
                          </Badge>

                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute top-2 left-2">
                              <div className="flex items-center gap-1 bg-primary/90 text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                Active
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Terminal info */}
                        <div className="mt-3 space-y-1">
                          <h3 className="font-semibold truncate flex items-center gap-2" title={terminal.name}>
                            <AvatarIcon terminalType={terminal.terminalType} size="xs" />
                            {terminal.name}
                          </h3>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{terminal.spawnLabel || terminal.terminalType}</span>
                            {terminal.createdAt && (
                              <span title={new Date(terminal.createdAt).toLocaleString()}>
                                {formatDistanceToNow(terminal.createdAt, { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </HoverCardTrigger>

                  {/* Hover card with additional details */}
                  <HoverCardContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-semibold flex items-center gap-2">
                        <AvatarIcon terminalType={terminal.terminalType} size="sm" />
                        {terminal.name}
                      </h4>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium">{terminal.spawnLabel || terminal.terminalType}</span>
                        </div>
                        {terminal.sessionName && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Session:</span>
                            <code className="text-xs bg-muted px-1 rounded">{terminal.sessionName}</code>
                          </div>
                        )}
                        {terminal.workingDir && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Directory:</span>
                            <code className="text-xs bg-muted px-1 rounded truncate max-w-[200px]" title={terminal.workingDir}>
                              {terminal.workingDir}
                            </code>
                          </div>
                        )}
                        {terminal.theme && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Theme:</span>
                            <span className="font-medium">{terminal.theme}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium">
                            {terminal.createdAt
                              ? new Date(terminal.createdAt).toLocaleString()
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </CarouselItem>
            );
          })}
        </CarouselContent>

        <CarouselPrevious className="hidden md:flex" />
        <CarouselNext className="hidden md:flex" />
      </Carousel>

      {/* Carousel info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Showing {visibleTerminals.length} terminal{visibleTerminals.length !== 1 ? 's' : ''} •
          Hover to pause • Click to switch
        </p>
      </div>
    </div>
  );
}
