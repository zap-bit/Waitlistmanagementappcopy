import { useState } from 'react';
import { X, Users, Table, Clock, MapPin, FileText, Plus, Trash2, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { Event, EventType, CapacityBasedEvent, TableBasedEvent, SimpleCapacityEvent, Queue } from '../utils/events';

interface CreateEventModalProps {
  businessId: string;
  onClose: () => void;
  onCreateEvent: (event: Event) => void;
}

export function CreateEventModal({ businessId, onClose, onCreateEvent }: CreateEventModalProps) {
  const [step, setStep] = useState<'type' | 'details'>('type');
  const [eventType, setEventType] = useState<EventType | null>(null);

  // Form fields
  const [eventName, setEventName] = useState('');
  const [capacity, setCapacity] = useState('100');
  const [estimatedWaitPerPerson, setEstimatedWaitPerPerson] = useState('5');
  const [location, setLocation] = useState('');
  const [queueMode, setQueueMode] = useState<'single' | 'multiple'>('single');
  const [queues, setQueues] = useState<Queue[]>([
    { id: '1', name: 'Queue 1', capacity: 100, currentCount: 0 }
  ]);
  const [numberOfTables, setNumberOfTables] = useState('12');
  const [averageTableSize, setAverageTableSize] = useState('4');
  const [reservationDuration, setReservationDuration] = useState('90');
  const [noShowPolicy, setNoShowPolicy] = useState('Hold table for 15 minutes');
  const [eventDate, setEventDate] = useState('');
  const [eventStartTime, setEventStartTime] = useState('');

  const handleSelectType = (type: EventType) => {
    setEventType(type);
    setStep('details');
  };

  const handleCreateEvent = () => {
    if (!eventType || !eventName.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const baseEvent = {
      id: `event-${Date.now()}`,
      businessId,
      name: eventName,
      createdAt: new Date(),
      status: 'active' as const,
    };

    let newEvent: Event;

    if (eventType === 'capacity-based') {
      if (!location.trim()) {
        toast.error('Please enter a location');
        return;
      }

      if (queueMode === 'multiple') {
        // Validate multiple queues
        if (queues.length === 0) {
          toast.error('Please add at least one queue');
          return;
        }
        if (queues.some(q => !q.name.trim())) {
          toast.error('Please name all queues');
          return;
        }
      }

      newEvent = {
        ...baseEvent,
        type: 'capacity-based',
        queueMode,
        capacity: queueMode === 'single' ? parseInt(capacity) || 100 : 0,
        estimatedWaitPerPerson: parseInt(estimatedWaitPerPerson) || 5,
        location,
        currentCount: 0,
        queues: queueMode === 'multiple' ? queues : undefined,
        eventDateTime: eventDate && eventStartTime ? new Date(`${eventDate}T${eventStartTime}:00`) : undefined,
      } as CapacityBasedEvent;
    } else if (eventType === 'simple-capacity') {
      if (!location.trim()) {
        toast.error('Please enter a location');
        return;
      }

      newEvent = {
        ...baseEvent,
        type: 'simple-capacity',
        capacity: parseInt(capacity) || 100,
        estimatedWaitPerPerson: parseInt(estimatedWaitPerPerson) || 5,
        location,
        currentCount: 0,
      } as SimpleCapacityEvent;
    } else {
      newEvent = {
        ...baseEvent,
        type: 'table-based',
        numberOfTables: parseInt(numberOfTables) || 12,
        averageTableSize: parseInt(averageTableSize) || 4,
        reservationDuration: parseInt(reservationDuration) || 90,
        noShowPolicy,
        currentFilledTables: 0,
        eventDateTime: eventDate && eventStartTime ? new Date(`${eventDate}T${eventStartTime}:00`) : undefined,
      } as TableBasedEvent;
    }

    onCreateEvent(newEvent);
    const modeText = eventType === 'capacity-based' && queueMode === 'multiple' 
      ? ` with ${queues.length} queues` 
      : '';
    toast.success(`Event "${eventName}"${modeText} created successfully!`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === 'type' ? 'Create New Event' : 'Event Details'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 'type' ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-6">Select the type of event you want to create</p>

              {/* Capacity-Based Event */}
              <button
                onClick={() => handleSelectType('capacity-based')}
                className="w-full p-6 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                    <Users className="w-6 h-6 text-blue-600 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Capacity-Based Event</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      For standing queues, lines, or events without assigned seating
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded">Queue capacity</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Wait time tracking</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">No tables</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Simple Capacity Event */}
              <button
                onClick={() => handleSelectType('simple-capacity')}
                className="w-full p-6 rounded-xl border-2 border-gray-200 hover:border-green-500 hover:bg-green-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-500 transition-colors">
                    <Gauge className="w-6 h-6 text-green-600 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Attendance-Tracking Event</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      For events where you need to track attendance and manage queues
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded">Queue capacity</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Wait time tracking</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">No tables</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Table-Based Event */}
              <button
                onClick={() => handleSelectType('table-based')}
                className="w-full p-6 rounded-xl border-2 border-gray-200 hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                    <Table className="w-6 h-6 text-purple-600 group-hover:text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 mb-1">Table-Based Event</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      For restaurants or events with table management and assigned seating
                    </p>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 bg-gray-100 rounded">Table grid</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Reservations</span>
                      <span className="px-2 py-1 bg-gray-100 rounded">Party size matching</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setStep('type')}
                className="text-sm text-blue-600 hover:text-blue-700 mb-4"
              >
                ← Change event type
              </button>

              {/* Event Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Name *
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Friday Night Dinner Service"
                />
              </div>

              {/* Capacity-Based Event Fields */}
              {eventType === 'capacity-based' && (
                <>
                  {/* Queue Mode Toggle */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Queue Configuration
                    </label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setQueueMode('single')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          queueMode === 'single'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Single Queue
                      </button>
                      <button
                        type="button"
                        onClick={() => setQueueMode('multiple')}
                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                          queueMode === 'multiple'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        Multiple Queues
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      {queueMode === 'single' 
                        ? 'One unified queue for all attendees' 
                        : 'Separate queues/lines (e.g., different rides or attractions)'}
                    </p>
                  </div>

                  {queueMode === 'single' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Event Date</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Event Start Time
                        </label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="time"
                            value={eventStartTime}
                            onChange={(e) => setEventStartTime(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Queue Capacity
                        </label>
                        <input
                          type="number"
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estimated Wait Per Person (minutes)
                        </label>
                        <input
                          type="number"
                          value={estimatedWaitPerPerson}
                          onChange={(e) => setEstimatedWaitPerPerson(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Location *
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Main entrance, Building A"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Location *
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Main entrance, Building A"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Estimated Wait Per Person (minutes)
                        </label>
                        <input
                          type="number"
                          value={estimatedWaitPerPerson}
                          onChange={(e) => setEstimatedWaitPerPerson(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="5"
                        />
                      </div>

                      {/* Multiple Queues Builder */}
                      <div className="border border-gray-300 rounded-xl p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700">
                            Queues/Lines
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newQueue: Queue = {
                                id: Date.now().toString(),
                                name: `Queue ${queues.length + 1}`,
                                capacity: 100,
                                currentCount: 0,
                              };
                              setQueues([...queues, newQueue]);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            Add Queue
                          </button>
                        </div>

                        <div className="space-y-2">
                          {queues.map((queue, index) => (
                            <div key={queue.id} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-gray-200">
                              <div className="flex gap-2 items-center">
                                <div className="flex-1">
                                  <input
                                    type="text"
                                    value={queue.name}
                                    onChange={(e) => {
                                      const updated = [...queues];
                                      updated[index] = { ...queue, name: e.target.value };
                                      setQueues(updated);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Queue name"
                                  />
                                </div>
                                <div className="w-28">
                                  <input
                                    type="number"
                                    value={queue.capacity}
                                    onChange={(e) => {
                                      const updated = [...queues];
                                      updated[index] = { ...queue, capacity: parseInt(e.target.value) || 0 };
                                      setQueues(updated);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Capacity"
                                  />
                                </div>
                                {queues.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setQueues(queues.filter((_, i) => i !== index));
                                    }}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <div className="flex-1">
                                  <input
                                    type="date"
                                    value={queue.eventDateTime ? queue.eventDateTime.toISOString().split('T')[0] : ''}
                                    onChange={(e) => {
                                      const updated = [...queues];
                                      const currentTime = queue.eventDateTime ? queue.eventDateTime.toISOString().split('T')[1].slice(0, 5) : '';
                                      updated[index] = { 
                                        ...queue, 
                                        eventDateTime: e.target.value && currentTime ? new Date(`${e.target.value}T${currentTime}:00`) : undefined 
                                      };
                                      setQueues(updated);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Date"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input
                                    type="time"
                                    value={queue.eventDateTime ? queue.eventDateTime.toISOString().split('T')[1].slice(0, 5) : ''}
                                    onChange={(e) => {
                                      const updated = [...queues];
                                      const currentDate = queue.eventDateTime ? queue.eventDateTime.toISOString().split('T')[0] : '';
                                      updated[index] = { 
                                        ...queue, 
                                        eventDateTime: currentDate && e.target.value ? new Date(`${currentDate}T${e.target.value}:00`) : undefined 
                                      };
                                      setQueues(updated);
                                    }}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Time"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Simple Capacity Event Fields */}
              {eventType === 'simple-capacity' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Queue Capacity
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Estimated Wait Per Person (minutes)
                    </label>
                    <input
                      type="number"
                      value={estimatedWaitPerPerson}
                      onChange={(e) => setEstimatedWaitPerPerson(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Location *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Main entrance, Building A"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Table-Based Event Fields */}
              {eventType === 'table-based' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Event Date</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Event Start Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Number of Tables
                    </label>
                    <input
                      type="number"
                      value={numberOfTables}
                      onChange={(e) => setNumberOfTables(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="12"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Average Table Size (seats)
                    </label>
                    <input
                      type="number"
                      value={averageTableSize}
                      onChange={(e) => setAverageTableSize(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="4"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reservation Duration (minutes)
                    </label>
                    <input
                      type="number"
                      value={reservationDuration}
                      onChange={(e) => setReservationDuration(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="90"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      No-Show Policy
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <textarea
                        value={noShowPolicy}
                        onChange={(e) => setNoShowPolicy(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        rows={3}
                        placeholder="Hold table for 15 minutes"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg transition-all"
                >
                  Create Event
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}