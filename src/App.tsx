import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Image as ImageIcon, 
  Calendar, 
  Users, 
  Trash2, 
  Plus, 
  ChevronLeft, 
  AlertTriangle, 
  X, 
  Check, 
  Search, 
  Info, 
  Sparkles,
  Shirt,
  Heart,
  FileText
} from 'lucide-react';

// Outfit Entry Interface
interface Entry {
  id: string;
  photo: string; // base64 string
  occasion: string;
  people: string; // comma-separated
  date: string;
}

export default function App() {
  // Application State
  const [entries, setEntries] = useState<Entry[]>([]);
  const [view, setView] = useState<'home' | 'capture' | 'details'>('home');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  
  // New Outfit Form State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [occasion, setOccasion] = useState('');
  const [people, setPeople] = useState('');
  const [date, setDate] = useState('');
  
  // UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');

  // Input refs for file triggers
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Load entries from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('outfit_time_capsule_entries');
      if (stored) {
        setEntries(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load outfits from localStorage:', e);
      setError('Could not load your saved outfits. Please ensure cookies and storage are enabled.');
    }
  }, []);

  // Set today's date when opening the capture view
  const setTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${year}-${month}-${day}`);
  };

  // Resize photo client-side using canvas
  const processPhotoFile = (file: File) => {
    setIsProcessing(true);
    setError(null);
    setQuotaError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 600;

          // Maintain aspect ratio while ensuring max width/height is 600px
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not initialize image processing canvas.');
          }

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Max quality 0.7, JPEG format as requested
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          setPhotoBase64(compressedBase64);
          setIsProcessing(false);
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'An error occurred while compressing your image.');
          setIsProcessing(false);
        }
      };
      
      img.onerror = () => {
        setError('Failed to load image. Please select a valid photo file.');
        setIsProcessing(false);
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      setError('Failed to read the selected photo file.');
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isCamera: boolean) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processPhotoFile(files[0]);
    }
  };

  // Helper to trigger hidden inputs
  const triggerCameraInput = () => {
    cameraInputRef.current?.click();
  };

  const triggerGalleryInput = () => {
    galleryInputRef.current?.click();
  };

  // Check similarity in current state
  const getSimilarOutfit = (): Entry | null => {
    if (!occasion.trim() && !people.trim()) return null;

    // Filter list
    const stopWords = new Set(['and', 'the', 'for', 'with', 'at', 'to', 'my', 'our', 'in', 'on', 'a', 'an', 'of', 'by']);
    const getWords = (str: string) => 
      str.toLowerCase()
         .replace(/[^\w\s]/g, ' ')
         .split(/\s+/)
         .filter(w => w.length >= 3 && !stopWords.has(w));

    const currentOccWords = getWords(occasion);
    const currentPeopleList = people.toLowerCase().split(',').map(p => p.trim()).filter(p => p.length > 0);

    // Scan backwards (newest first)
    for (const entry of entries) {
      // 1. Check occasion matching (either direct substring or overlapping substantial words)
      let matchOccasion = false;
      const entryOccLower = entry.occasion.toLowerCase().trim();
      const currentOccLower = occasion.toLowerCase().trim();

      if (currentOccLower && entryOccLower) {
        if (entryOccLower.includes(currentOccLower) || currentOccLower.includes(entryOccLower)) {
          matchOccasion = true;
        } else {
          const entryWords = getWords(entry.occasion);
          const hasWordOverlap = currentOccWords.some(w => entryWords.includes(w));
          if (hasWordOverlap) {
            matchOccasion = true;
          }
        }
      }

      // 2. Check overlapping people list
      let matchPeople = false;
      if (currentPeopleList.length > 0 && entry.people) {
        const entryPeopleList = entry.people.toLowerCase().split(',').map(p => p.trim()).filter(p => p.length > 0);
        const hasPeopleOverlap = currentPeopleList.some(p => entryPeopleList.includes(p));
        if (hasPeopleOverlap) {
          matchPeople = true;
        }
      }

      // If either overlaps, we trigger the similarity reminder card
      if (matchOccasion || matchPeople) {
        return entry;
      }
    }

    return null;
  };

  const similarOutfit = getSimilarOutfit();

  // Save the outfit entry
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBase64) {
      setError('Please capture or choose a photo first!');
      return;
    }

    if (!occasion.trim()) {
      setError('Please enter an occasion (e.g., Birthday dinner).');
      return;
    }

    const newEntry: Entry = {
      id: 'outfit_' + Date.now(),
      photo: photoBase64,
      occasion: occasion.trim(),
      people: people.trim(),
      date: date || new Date().toISOString().split('T')[0]
    };

    const updatedEntries = [newEntry, ...entries];

    try {
      localStorage.setItem('outfit_time_capsule_entries', JSON.stringify(updatedEntries));
      setEntries(updatedEntries);
      
      // Reset form & Navigate Home
      setPhotoBase64(null);
      setOccasion('');
      setPeople('');
      setDate('');
      setView('home');
      setError(null);
      setQuotaError(null);
    } catch (err: any) {
      console.error('LocalStorage error:', err);
      // Check for quota exceptions
      if (err.name === 'QuotaExceededError' || err.code === 22 || err.number === 0x8007000E) {
        setQuotaError(
          "Storage Limit Reached! Your browser's memory is full. Please delete a few older outfit memories to make space for this new one."
        );
      } else {
        setError('Could not save outfit to local storage. Please check permissions.');
      }
    }
  };

  // Delete current selected entry
  const handleDeleteEntry = (id: string) => {
    const updatedEntries = entries.filter(e => e.id !== id);
    try {
      localStorage.setItem('outfit_time_capsule_entries', JSON.stringify(updatedEntries));
      setEntries(updatedEntries);
      setView('home');
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('Failed to update storage after delete:', err);
      setError('Could not remove the selected outfit. Please try again.');
    }
  };

  // Format dates beautifully
  const formatFriendlyDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Search filter
  const filteredEntries = entries.filter(entry => {
    const searchLower = searchTerm.toLowerCase();
    const matchesOccasion = entry.occasion.toLowerCase().includes(searchLower);
    const matchesPeople = entry.people.toLowerCase().includes(searchLower);
    const matchesDate = entry.date.includes(searchLower);
    return matchesOccasion || matchesPeople || matchesDate;
  });

  // Unique insights statistics to enhance the fashion diary aesthetic
  const totalOutfits = entries.length;
  const uniqueOccasionsCount = new Set(entries.map(e => e.occasion.trim().toLowerCase())).size;
  const uniquePeople = Array.from(
    new Set(
      entries
        .flatMap(e => e.people.split(','))
        .map(p => p.trim().toLowerCase())
        .filter(p => p.length > 0)
    )
  );

  return (
    <div className="min-h-screen bg-[#F4EFE6] text-[#2C2523] font-sans flex flex-col items-center p-0 md:p-6 select-none">
      {/* Container simulating a refined Mobile Frame on desktop, seamless on mobile */}
      <div className="w-full max-w-md bg-[#FAF6F0] min-h-screen md:min-h-[850px] md:max-h-[900px] md:rounded-3xl shadow-xl border border-[#E5DEC9]/40 flex flex-col relative overflow-hidden md:my-4">
        
        {/* Header Bar */}
        <header className="px-5 py-4 bg-white/80 backdrop-blur-md border-b border-[#EADFC9]/50 sticky top-0 z-40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#D36B51]/10 rounded-lg text-[#D36B51]">
              <Shirt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg tracking-tight text-[#2C2523]">
                Outfit Time-Capsule
              </h1>
              <p className="text-[10px] text-[#8C7E74] tracking-wider uppercase font-medium">
                Your Visual Style Diary
              </p>
            </div>
          </div>
          
          {view === 'home' && (
            <button 
              id="add-outfit-btn-header"
              onClick={() => {
                setPhotoBase64(null);
                setOccasion('');
                setPeople('');
                setTodayDate();
                setView('capture');
                setError(null);
                setQuotaError(null);
              }}
              className="p-2 bg-[#D36B51] hover:bg-[#C05D44] text-white rounded-full shadow-md transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center"
              title="Record New Outfit"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </header>

        {/* Global Error Notice */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2 animate-fade-in relative z-50">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 pr-4">
              <p className="font-semibold">Notice</p>
              <p className="opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="absolute top-2 right-2 text-red-400 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Body */}
        <main className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
          
          {/* ==================== HOME VIEW ==================== */}
          {view === 'home' && (
            <div className="p-4 flex flex-col flex-1 animate-fade-in">
              
              {/* Stats Bar */}
              {entries.length > 0 && (
                <div className="mb-4 bg-[#F1EAD9]/60 border border-[#E5DEC9]/50 rounded-2xl p-3 flex justify-around text-center">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-serif font-bold text-[#D36B51]">{totalOutfits}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#8C7E74]">Outfits</span>
                  </div>
                  <div className="w-px bg-[#E5DEC9] my-1" />
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-serif font-bold text-[#2C2523]">{uniqueOccasionsCount}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#8C7E74]">Events</span>
                  </div>
                  <div className="w-px bg-[#E5DEC9] my-1" />
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-serif font-bold text-[#2C2523]">{uniquePeople.length}</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#8C7E74]">Mates</span>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative mb-5" id="search-bar-container">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D82] w-4.5 h-4.5" />
                <input 
                  id="search-input"
                  type="text"
                  placeholder="Search by occasion, date, or companion..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#E5DEC9] rounded-xl text-sm text-[#2C2523] placeholder-[#A89C91] focus:outline-none focus:border-[#D36B51] focus:ring-1 focus:ring-[#D36B51] transition-all shadow-xs"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A8D82] hover:text-[#2C2523] p-0.5 rounded-full hover:bg-neutral-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Grid Content / Empty State */}
              {entries.length === 0 ? (
                /* Empty State */
                <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 text-center" id="empty-state-view">
                  <div className="w-20 h-20 bg-[#D36B51]/10 rounded-full flex items-center justify-center text-[#D36B51] mb-6 animate-pulse">
                    <Shirt className="w-10 h-10" />
                  </div>
                  
                  <h3 className="font-serif font-bold text-xl text-[#2C2523] mb-2">
                    Your Wardrobe's Story Begins Here
                  </h3>
                  
                  <p className="text-sm text-[#7A6E67] max-w-xs mb-8 leading-relaxed">
                    Capture your outfits, record who you were with, and preserve beautiful fashion memories so you never have to guess "what did I wear?" again.
                  </p>

                  {/* Fashion Quote Accent */}
                  <div className="border-t border-b border-[#E8DEC7]/60 py-4 px-6 mb-8 max-w-xs bg-white/40 rounded-xl italic font-serif text-xs text-[#8C7E74] leading-relaxed">
                    "Style is a way to say who you are without having to speak."
                    <span className="block mt-1.5 not-italic font-sans text-[10px] tracking-wider uppercase text-[#A09287]">
                      — Rachel Zoe
                    </span>
                  </div>

                  <button 
                    id="add-first-outfit-btn"
                    onClick={() => {
                      setPhotoBase64(null);
                      setOccasion('');
                      setPeople('');
                      setTodayDate();
                      setView('capture');
                      setError(null);
                      setQuotaError(null);
                    }}
                    className="w-full py-3.5 px-6 bg-[#D36B51] hover:bg-[#C05D44] text-white rounded-xl shadow-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 transform active:scale-[0.98]"
                  >
                    <Camera className="w-5 h-5" />
                    Record First Outfit
                  </button>
                </div>
              ) : filteredEntries.length === 0 ? (
                /* Search No Results */
                <div className="flex-1 flex flex-col justify-center items-center py-16 text-center">
                  <div className="p-4 bg-amber-50 rounded-full text-amber-600 mb-4">
                    <Search className="w-8 h-8" />
                  </div>
                  <h4 className="font-serif font-bold text-base text-[#2C2523]">No matching outfits</h4>
                  <p className="text-xs text-[#7A6E67] mt-1 max-w-xs">
                    We couldn't find any memories matching "{searchTerm}". Try checking your spelling or look for dates in YYYY-MM-DD format.
                  </p>
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="mt-4 px-4 py-2 bg-[#EADFC9]/50 hover:bg-[#E2D5BE] text-[#5C5046] text-xs font-semibold rounded-lg transition-colors"
                  >
                    Clear Search
                  </button>
                </div>
              ) : (
                /* Grid of outfits */
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-[#8C7E74]">
                      {filteredEntries.length === entries.length 
                        ? 'All Captured Memories' 
                        : `Found ${filteredEntries.length} memories`}
                    </span>
                    <span className="text-[10px] text-[#A89C91] italic">
                      Newest first
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-8" id="outfit-grid-list">
                    {filteredEntries.map((entry) => (
                      <div 
                        id={`entry-card-${entry.id}`}
                        key={entry.id}
                        onClick={() => {
                          setSelectedEntry(entry);
                          setView('details');
                        }}
                        className="group bg-white rounded-2xl border border-[#EADFC9]/40 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col transform hover:-translate-y-0.5 active:translate-y-0"
                      >
                        {/* Image Frame */}
                        <div className="relative aspect-[3/4] w-full bg-[#EDE8DC] overflow-hidden">
                          <img 
                            src={entry.photo} 
                            alt={entry.occasion} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          {entry.people && (
                            <div className="absolute bottom-2 left-2 bg-black/40 backdrop-blur-xs text-white px-2 py-0.5 rounded-full text-[9px] flex items-center gap-1 font-sans">
                              <Users className="w-2.5 h-2.5" />
                              <span className="truncate max-w-[80px]">
                                {entry.people.split(',')[0]}
                                {entry.people.split(',').length > 1 && '+'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Text Metadata */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <h4 className="font-serif font-bold text-sm text-[#2C2523] truncate leading-tight mb-1" title={entry.occasion}>
                            {entry.occasion}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-[#7A6E67]">
                            <Calendar className="w-3 h-3 text-[#A89C91] shrink-0" />
                            <span>{formatFriendlyDate(entry.date)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* ==================== CAPTURE VIEW ==================== */}
          {view === 'capture' && (
            <div className="p-5 flex flex-col flex-1 animate-fade-in">
              
              {/* Back button */}
              <button 
                onClick={() => setView('home')} 
                className="flex items-center gap-1 text-xs font-semibold text-[#8C7E74] hover:text-[#2C2523] mb-5 w-fit"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Capsule
              </button>

              <h2 className="font-serif font-bold text-xl text-[#2C2523] mb-1">
                Capture the Moment
              </h2>
              <p className="text-xs text-[#7A6E67] mb-6">
                Save an outfit to look back on. Start by taking or choosing a photo.
              </p>

              {/* Hidden File Inputs */}
              {/* Direct camera capture targeting */}
              <input 
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileChange(e, true)}
                className="hidden"
              />
              {/* Standard file explorer selection */}
              <input 
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, false)}
                className="hidden"
              />

              {/* Step 1: Photo Selector Frame */}
              {!photoBase64 && (
                <div className="flex-1 flex flex-col justify-center gap-4 py-4" id="photo-picker-container">
                  {isProcessing ? (
                    <div className="bg-white rounded-3xl border-2 border-dashed border-[#E5DEC9] aspect-[3/4] w-full flex flex-col justify-center items-center p-6 text-center">
                      <div className="w-12 h-12 rounded-full border-4 border-[#D36B51]/20 border-t-[#D36B51] animate-spin mb-4" />
                      <p className="text-sm font-serif font-semibold text-[#2C2523]">Developing your photo...</p>
                      <p className="text-xs text-[#7A6E67] mt-1">Compressing and sizing client-side for fast storage.</p>
                    </div>
                  ) : (
                    <>
                      {/* Option 1: Live Camera (Primary) */}
                      <button 
                        onClick={triggerCameraInput}
                        className="bg-[#D36B51] hover:bg-[#C05D44] text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] shadow-md border border-[#C2583F]"
                      >
                        <div className="p-3.5 bg-white/10 rounded-full">
                          <Camera className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <p className="font-serif font-bold text-base">Open Phone Camera</p>
                          <p className="text-xs text-white/80 mt-1">Snaps directly on your smartphone</p>
                        </div>
                      </button>

                      {/* Option 2: Gallery Picker (Secondary) */}
                      <button 
                        onClick={triggerGalleryInput}
                        className="bg-white hover:bg-[#FAF6F0] text-[#2C2523] rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center transition-all duration-200 border border-[#E5DEC9] shadow-xs"
                      >
                        <div className="p-3.5 bg-[#FAF6F0] rounded-full text-[#7A6E67]">
                          <ImageIcon className="w-8 h-8 text-[#D36B51]" />
                        </div>
                        <div>
                          <p className="font-serif font-bold text-base text-[#2C2523]">Choose from Photo Gallery</p>
                          <p className="text-xs text-[#7A6E67] mt-1">Select an existing photo from library</p>
                        </div>
                      </button>

                      {/* Helpful Privacy/Storage Tip */}
                      <div className="mt-4 p-4 rounded-xl bg-[#F0EAE1]/50 border border-[#E5DEC9]/50 flex items-start gap-2.5 text-[11px] text-[#7A6E67] leading-relaxed">
                        <Info className="w-4 h-4 text-[#D36B51] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-[#2C2523]">100% Private & Client-Side</p>
                          <p className="mt-0.5">Your style photos are automatically optimized to less than 60KB and stay completely secure on your own physical device. No server uploads ever.</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Step 2: Form Input Frame (After Photo is loaded) */}
              {photoBase64 && (
                <form onSubmit={handleSaveEntry} className="flex-1 flex flex-col gap-4 pb-12" id="outfit-details-form">
                  
                  {/* Photo Preview Card */}
                  <div className="relative aspect-[3/4] w-full max-h-[220px] bg-neutral-100 rounded-2xl overflow-hidden border border-[#E5DEC9] shadow-inner">
                    <img 
                      src={photoBase64} 
                      alt="Captured look" 
                      className="w-full h-full object-cover"
                    />
                    <button 
                      type="button"
                      onClick={() => setPhotoBase64(null)}
                      className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors flex items-center justify-center"
                      title="Remove Photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-3 bg-[#FAF6F0] px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border border-[#E5DEC9]/60 text-[#D36B51]">
                      Ready for Capsule
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="flex flex-col gap-3.5">
                    
                    {/* Occasion */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="occasion-input" className="text-xs font-bold tracking-wider uppercase text-[#7A6E67] flex items-center gap-1">
                        What was the Occasion? <span className="text-[#D36B51]">*</span>
                      </label>
                      <input 
                        id="occasion-input"
                        type="text"
                        required
                        placeholder='e.g., Birthday dinner, Wedding, Beach walk'
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E5DEC9] rounded-xl text-sm text-[#2C2523] placeholder-[#A89C91] focus:outline-none focus:border-[#D36B51]"
                      />
                    </div>

                    {/* Companion */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="people-input" className="text-xs font-bold tracking-wider uppercase text-[#7A6E67]">
                        Who were you with? (optional)
                      </label>
                      <input 
                        id="people-input"
                        type="text"
                        placeholder="e.g., Sarah, Jessica, David (comma separated)"
                        value={people}
                        onChange={(e) => setPeople(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-[#E5DEC9] rounded-xl text-sm text-[#2C2523] placeholder-[#A89C91] focus:outline-none focus:border-[#D36B51]"
                      />
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1">
                      <label htmlFor="date-input" className="text-xs font-bold tracking-wider uppercase text-[#7A6E67]">
                        When did you wear this?
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A8D82] w-4.5 h-4.5 pointer-events-none" />
                        <input 
                          id="date-input"
                          type="date"
                          required
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E5DEC9] rounded-xl text-sm text-[#2C2523] focus:outline-none focus:border-[#D36B51]"
                        />
                      </div>
                    </div>

                  </div>

                  {/* Quota Error / Alert */}
                  {quotaError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-900 text-xs rounded-xl flex items-start gap-2.5 mt-2 animate-bounce">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Quota Exceeded Error</p>
                        <p className="opacity-95">{quotaError}</p>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Similarity Check Reminder Card */}
                  {similarOutfit && (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 shadow-sm animate-fade-in mt-2" id="similarity-alert-card">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-serif font-semibold text-amber-950 text-sm">Outfit Repeating Alert!</h4>
                          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            You already logged a similar outfit for <strong className="font-serif italic">"{similarOutfit.occasion}"</strong> on {formatFriendlyDate(similarOutfit.date)} {similarOutfit.people ? `with ${similarOutfit.people}` : ''}.
                          </p>
                          <div className="mt-3 flex gap-3 items-center">
                            <img src={similarOutfit.photo} alt="Past outfit memory" className="w-14 h-18 object-cover rounded-lg border border-amber-200/60 shadow-xs shrink-0" />
                            <div className="text-[11px] text-amber-700 font-serif italic">
                              "Keep repeating if it brings you joy, or switch it up!"
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Submission Buttons */}
                  <div className="flex gap-3 mt-4">
                    <button 
                      type="button"
                      onClick={() => setPhotoBase64(null)}
                      className="flex-1 py-3 px-4 bg-white hover:bg-[#FAF6F0] text-[#7A6E67] font-semibold border border-[#E5DEC9] rounded-xl text-sm transition-colors"
                    >
                      Re-take Photo
                    </button>
                    <button 
                      id="save-outfit-submit-btn"
                      type="submit"
                      className="flex-1 py-3 px-4 bg-[#D36B51] hover:bg-[#C05D44] text-white font-semibold rounded-xl text-sm transition-all duration-200 shadow-md flex items-center justify-center gap-1.5 transform active:scale-[0.98]"
                    >
                      <Check className="w-4 h-4" /> Save to Capsule
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}


          {/* ==================== DETAILS VIEW ==================== */}
          {view === 'details' && selectedEntry && (
            <div className="p-5 flex flex-col flex-1 animate-fade-in">
              
              {/* Back button */}
              <button 
                id="back-home-from-details"
                onClick={() => {
                  setView('home');
                  setSelectedEntry(null);
                  setShowDeleteConfirm(false);
                }} 
                className="flex items-center gap-1 text-xs font-semibold text-[#8C7E74] hover:text-[#2C2523] mb-5 w-fit"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Grid
              </button>

              {/* Polaroid-Inspired Editorial Wardrobe Frame */}
              <div className="bg-white p-4 pb-6 rounded-2xl shadow-md border border-[#E5DEC9]/40 flex flex-col gap-4 transform rotate-1 hover:rotate-0 transition-transform duration-300">
                
                {/* Visual Canvas Image */}
                <div className="aspect-[3/4] w-full bg-[#EDE8DC] rounded-lg overflow-hidden border border-[#E5DEC9]/30 relative">
                  <img 
                    src={selectedEntry.photo} 
                    alt={selectedEntry.occasion} 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Polaroid Metadata Section - Styled with a lovely hand-written style serif vibe */}
                <div className="px-1 text-center flex flex-col items-center">
                  <h3 className="font-serif font-bold text-xl text-[#2C2523] leading-snug tracking-tight">
                    {selectedEntry.occasion}
                  </h3>
                  
                  <div className="mt-2 text-xs font-serif italic text-[#8C7E74]">
                    Recorded on {formatFriendlyDate(selectedEntry.date)}
                  </div>
                </div>

              </div>

              {/* Informational specs below Polaroid Card */}
              <div className="mt-6 flex flex-col gap-4 bg-white/50 border border-[#EADFC9]/40 rounded-2xl p-4">
                
                {/* Occasion tag */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-[#D36B51]/10 rounded-lg text-[#D36B51] shrink-0">
                    <Shirt className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9A8D82]">Occasion Category</span>
                    <span className="text-sm font-semibold text-[#2C2523]">{selectedEntry.occasion}</span>
                  </div>
                </div>

                {/* Date spec */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-[#D36B51]/10 rounded-lg text-[#D36B51] shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9A8D82]">Diary Date</span>
                    <span className="text-sm font-semibold text-[#2C2523]">{formatFriendlyDate(selectedEntry.date)}</span>
                  </div>
                </div>

                {/* Companions spec */}
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-[#D36B51]/10 rounded-lg text-[#D36B51] shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold tracking-wider text-[#9A8D82]">Shared With</span>
                    <span className="text-sm font-semibold text-[#2C2523]">
                      {selectedEntry.people ? (
                        <span className="flex flex-wrap gap-1 mt-1">
                          {selectedEntry.people.split(',').map((p, idx) => (
                            <span key={idx} className="bg-white border border-[#E5DEC9] px-2 py-0.5 rounded-md text-xs font-medium text-[#5C5046]">
                              {p.trim()}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-xs text-[#9A8D82] italic">Just a quiet moment with myself</span>
                      )}
                    </span>
                  </div>
                </div>

              </div>

              {/* Action Buttons: Delete */}
              <div className="mt-6" id="details-actions">
                {!showDeleteConfirm ? (
                  <button 
                    id="delete-entry-trigger"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-3 px-4 text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100/60 rounded-xl border border-red-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete this style memory
                  </button>
                ) : (
                  <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl flex flex-col gap-3 animate-fade-in" id="delete-confirmation-box">
                    <div className="text-xs text-red-900 leading-relaxed font-semibold">
                      Are you absolutely sure? This will permanently erase this gorgeous memory from your device.
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 py-2 px-3 bg-white border border-[#E5DEC9] text-[#7A6E67] text-xs font-semibold rounded-lg hover:bg-[#FAF6F0] transition-colors"
                      >
                        Keep memory
                      </button>
                      <button 
                        id="confirm-delete-entry-btn"
                        onClick={() => handleDeleteEntry(selectedEntry.id)}
                        className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" /> Erase forever
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}

        </main>

        {/* Footer info brand badge */}
        <footer className="py-4 text-center border-t border-[#EADFC9]/30 bg-white/20 select-none">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#A89C91]">
            <Sparkles className="w-3 h-3 text-[#D36B51]" />
            <span>Curated Offline Fashion Journal</span>
            <span>•</span>
            <span className="font-mono">v1.1.0</span>
          </div>
        </footer>

      </div>
    </div>
  );
}
