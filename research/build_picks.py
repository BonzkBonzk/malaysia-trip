# Build picks.js from research/*.json batch files (each: {id: {...}}).
import json,glob,sys
repo=sys.argv[1]
data={}
for f in sorted(glob.glob('research/batch*.json')):
    for k,v in json.load(open(f,encoding='utf-8')).items():
        data.setdefault(k,{}).update(v)
js='''// Curated research results (generated). Each entry either updates an existing
// place by id or, when it carries a title and coordinates, adds a new one.
// "evidence" and "note" extend reviews.js for that id.
const pickData = %s;
for (const [id, v] of Object.entries(pickData)) {
  const {evidence, note, photo, ...fields} = v;
  if (photo) venuePhotos[id] = photo;
  const existing = basePlaces.find(p => p.id === id);
  if (existing) Object.assign(existing, fields);
  else if (fields.title && fields.lat != null) basePlaces.push({id, category: 'food', ...fields});
  if (evidence) publishedEvidence[id] = [...evidence, ...(publishedEvidence[id] || [])];
  if (note) reviewAssessmentNotes[id] = note;
}
''' % json.dumps(data,ensure_ascii=False,indent=1)
open(f'{repo}/picks.js','w',encoding='utf-8').write(js)
print(len(data),'entries')
