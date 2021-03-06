var get = Ember.get, set = Ember.set, getPath = Ember.getPath;

var store, Person;

module("DS.Model", {
  setup: function() {
    store = DS.Store.create();

    Person = DS.Model.extend({
      name: DS.attr('string')
    });
  },

  teardown: function() {
    store = null;
    Person = null;
  }
});

test("can have a property set on it", function() {
  var record = store.createRecord(Person);
  set(record, 'name', 'bar');

  equal(get(record, 'name'), 'bar', "property was set on the model");
});

test("a record reports its unique id via the `id` property", function() {
  store.load(Person, { id: 1 });

  var record = store.find(Person, 1);
  equal(get(record, 'id'), 1, "reports id as id by default");

  var PersonWithPrimaryKey = DS.Model.extend({
    primaryKey: 'foobar'
  });

  store.load(PersonWithPrimaryKey, { id: 1, foobar: 2 });
  record = store.find(PersonWithPrimaryKey, 2);

  equal(get(record, 'id'), 2, "reports id as foobar when primaryKey is set");
});

var converts = function(type, provided, expected) {
  var testStore = DS.Store.create();

  var Model = DS.Model.extend({
    name: DS.attr(type)
  });

  testStore.load(Model, { id: 1, name: provided });
  testStore.load(Model, { id: 2 });

  var record = testStore.find(Model, 1);
  deepEqual(get(record, 'name'), expected, type + " coerces " + provided + " to " + expected);

  record = testStore.find(Model, 2);
  set(record, 'name', provided);
  deepEqual(get(record, 'name'), expected, type + " coerces " + provided + " to " + expected);
};

var convertsFromServer = function(type, provided, expected) {
  var testStore = DS.Store.create();

  var Model = DS.Model.extend({
    name: DS.attr(type)
  });

  testStore.load(Model, { id: 1, name: provided });
  var record = testStore.find(Model, 1);

  deepEqual(get(record, 'name'), expected, type + " coerces " + provided + " to " + expected);
};

var convertsWhenSet = function(type, provided, expected) {
  var testStore = DS.Store.create();

  var Model = DS.Model.extend({
    name: DS.attr(type)
  });

  testStore.load(Model, { id: 2 });
  var record = testStore.find(Model, 2);

  set(record, 'name', provided);
  deepEqual(record.toJSON().name, expected, type + " saves " + provided + " as " + expected);
};

test("a DS.Model can describe String attributes", function() {
  converts('string', "Scumbag Tom", "Scumbag Tom");
  converts('string', 1, "1");
  converts('string', null, null);
  converts('string', undefined, null);
  convertsFromServer('string', undefined, null);
});

test("a DS.Model can describe Number attributes", function() {
  converts('number', "1", 1);
  converts('number', "0", 0);
  converts('number', 1, 1);
  converts('number', 0, 0);
  converts('number', null, null);
  converts('number', undefined, null);
  converts('number', true, 1);
  converts('number', false, 0);
});

test("a DS.Model can describe Boolean attributes", function() {
  converts('boolean', "1", true);
  converts('boolean', "", false);
  converts('boolean', 1, true);
  converts('boolean', 0, false);
  converts('boolean', null, false);
  converts('boolean', true, true);
  converts('boolean', false, false);
});

test("a DS.Model can describe Date attributes", function() {
  converts('date', null, null);
  converts('date', undefined, undefined);

  var dateString = "Sat, 31 Dec 2011 00:08:16 GMT";
  var date = new Date(dateString);

  var store = DS.Store.create();

  var Person = DS.Model.extend({
    updatedAt: DS.attr('date')
  });

  store.load(Person, { id: 1 });
  var model = store.find(Person, 1);

  model.set('updatedAt', date);
  deepEqual(date, get(model, 'updatedAt'), "setting a date returns the same date");
  convertsFromServer('date', dateString, date);
  convertsWhenSet('date', date, dateString);
});

test("retrieving properties should return the same value as they would if they were not in the data hash if the record is not loaded", function() {
  var store = DS.Store.create({
    adapter: DS.Adapter.create({
      // no-op
      find: Ember.K
    })
  });

  var Person = DS.Model.extend({
    name: DS.attr('string')
  });

  var record = store.find(Person, 1);

  strictEqual(get(record, 'name'), null, "returns null value");
});

test("it should cache attributes", function() {
  var store = DS.Store.create();

  var Post = DS.Model.extend({
    updatedAt: DS.attr('date')
  });

  var dateString = "Sat, 31 Dec 2011 00:08:16 GMT";
  var date = new Date(dateString);

  store.load(Post, { id: 1 });

  var model = store.find(Post, 1);

  model.set('updatedAt', date);
  deepEqual(date, get(model, 'updatedAt'), "setting a date returns the same date");
  strictEqual(get(model, 'updatedAt'), get(model, 'updatedAt'), "second get still returns the same object");
});

test("it can specify which key to use when looking up properties on the hash", function() {
  var Model = DS.Model.extend({
    name: DS.attr('string', { key: 'full_name' })
  });

  store.load(Model, { id: 1, name: "Steve", full_name: "Pete" });
  var record = store.find(Model, 1);

  equal(get(record, 'name'), "Pete", "retrieves correct value");
});

test("it can specify a naming convention", function() {
  var convention = {
    keyToJSONKey: function(key) {
      return Ember.String.decamelize(key);
    },

    foreignKey: function(key) {
      return key + '_id';
    }
  };

  var store = DS.Store.create();

  var Model = DS.Model.extend({
    namingConvention: convention,

    firstName: DS.attr('string'),
    lastName: DS.attr('string', { key: 'lastName' })
  });

  store.load(Model, { id: 1, first_name: "Tom", lastName: "Dale" });
  var tom = store.find(Model, 1);

  equal(get(tom, 'firstName'), "Tom", "the naming convention is used by default");
  equal(get(tom, 'lastName'), "Dale", "the naming convention is unused if a key is specified");

  deepEqual(tom.toJSON(), {
    id: 1,
    first_name: "Tom",
    lastName: "Dale"
  }, "toJSON takes naming convention into consideration");
});

test("toJSON returns a hash containing the JSON representation of the record", function() {
  var Model = DS.Model.extend({
    firstName: DS.attr('string'),
    lastName: DS.attr('string', { key: 'lastName' }),
    country: DS.attr('string', { defaultValue: 'US' }),
    isHipster: DS.attr('boolean', { defaultValue: false })
  });

  store.load(Model, { id: 1, first_name: "Tom", lastName: "Dale", other: "none" });
  var record = store.find(Model, 1);

  set(record, 'isHipster', true);

  deepEqual(record.toJSON(), { id: 1, first_name: "Tom", lastName: "Dale", country: 'US', is_hipster: true }, "the data is extracted by attribute");

  record = Model.createRecord({ firstName: "Yehuda", lastName: "Katz", country: null });
  deepEqual(record.toJSON(), { first_name: "Yehuda", lastName: "Katz", country: null, is_hipster: false }, "the data is extracted by attribute");
});

test("toJSON includes associations when the association option is set", function() {
  var PhoneNumber = DS.Model.extend({
    number: DS.attr('string')
  });

  var Contact = DS.Model.extend({
    name: DS.attr('string'),
    phoneNumbers: DS.hasMany(PhoneNumber)
  });

  store.load(PhoneNumber, { id: 7, number: '123' });
  store.load(PhoneNumber, { id: 8, number: '345' });

  store.load(Contact, { id: 1, name: "Chad", phoneNumbers: [7, 8] });

  var record = store.find(Contact, 1);

  deepEqual(record.toJSON(), { id: 1, name: "Chad" }, "precond - associations not included by default");
  deepEqual(record.toJSON({ associations: true }),
            { id: 1, name: "Chad", phoneNumbers: [7,8] },
            "associations are included when association flag is set");

  store.load(PhoneNumber, { id: 9, number: '789' });
  var phoneNumber = store.find(PhoneNumber, 9);

  record.get('phoneNumbers').pushObject(phoneNumber);

  deepEqual(record.toJSON({ associations: true }),
            { id: 1, name: "Chad", phoneNumbers: [7,8,9] },
            "association is updated after editing associations array");
});

test("toJSON includes embedded associations when an association is embedded", function() {
  var PhoneNumber = DS.Model.extend({
    number: DS.attr('string')
  });

  var Contact = DS.Model.extend({
    name: DS.attr('string'),
    phoneNumbers: DS.hasMany(PhoneNumber, {
      embedded: true
    })
  });

  store.load(Contact, { id: 1, name: "Chad", phoneNumbers: [{
    id: 7,
    number: '123'
  },

  {
    id: 8,
    number: '345'
  }]});

  var record = store.find(Contact, 1);

  deepEqual(record.toJSON(), { id: 1, name: "Chad" }, "precond - associations not included by default");
  deepEqual(record.toJSON({ associations: true }),
            { id: 1, name: "Chad", phoneNumbers: [{
                id: 7,
                number: '123'
              },
              {
                id: 8,
                number: '345'
              }
            ]},
            "associations are included when association flag is set");

  store.load(PhoneNumber, { id: 9, number: '789' });
  var phoneNumber = store.find(PhoneNumber, 9);

  record.get('phoneNumbers').pushObject(phoneNumber);

  deepEqual(record.toJSON({ associations: true }),
            { id: 1, name: "Chad", phoneNumbers: [{
                id: 7,
                number: '123'
              },
              {
                id: 8,
                number: '345'
              },
              {
                id: 9,
                number: '789'
              }
            ]},
            "association is updated after editing associations array");
});

var Person, store, array;

module("DS.Model updating", {
  setup: function() {
    array = [{ id: 1, name: "Scumbag Dale" }, { id: 2, name: "Scumbag Katz" }, { id: 3, name: "Scumbag Bryn" }];
    Person = DS.Model.extend({ name: DS.attr('string') });
    store = DS.Store.create();
    store.loadMany(Person, array);
  }
});

test("a DS.Model can update its attributes", function() {
  var person = store.find(Person, 2);

  set(person, 'name', "Brohuda Katz");
  equal(get(person, 'name'), "Brohuda Katz", "setting took hold");
});

test("a DS.Model can have a defaultValue", function() {
  var Tag = DS.Model.extend({
    name: DS.attr('string', { defaultValue: "unknown" })
  });

  var tag = Tag.createRecord();

  equal(get(tag, 'name'), "unknown", "the default value is found");

  set(tag, 'name', null);

  equal(get(tag, 'name'), null, "null doesn't shadow defaultValue");
});

test("it should modify the property of the hash specified by the `key` option", function() {
  var store = DS.Store.create();
  var Person = DS.Model.extend({
    name: DS.attr('string', { key: 'full_name' })
  });

  store.load(Person, { id: 1, name: "Steve", full_name: "Peter" });
  var record = store.find(Person, 1);

  record.set('name', "Colin");

  var data = record.toJSON();
  equal(get(data, 'full_name'), "Colin", "properly modified full_name property");
  strictEqual(get(data, 'name'), undefined, "does not include non-defined attributes");
});

test("when a DS.Model updates its attributes, its changes affect its filtered Array membership", function() {
  var people = store.filter(Person, function(hash) {
    if (hash.get('name').match(/Katz$/)) { return true; }
  });

  equal(get(people, 'length'), 1, "precond - one item is in the ModelArray");

  var person = people.objectAt(0);

  equal(get(person, 'name'), "Scumbag Katz", "precond - the item is correct");

  Ember.run(function() {
    set(person, 'name', "Yehuda Katz");
  });

  equal(get(people, 'length'), 1, "there is still one item");
  equal(get(person, 'name'), "Yehuda Katz", "it has the updated item");

  Ember.run(function() {
    set(person, 'name', "Yehuda Katz-Foo");
  });

  equal(get(people, 'length'), 0, "there are now no items");
});

module("with a simple Person model", {
  setup: function() {
    array = [{ id: 1, name: "Scumbag Dale" }, { id: 2, name: "Scumbag Katz" }, { id: 3, name: "Scumbag Bryn" }];
    Person = DS.Model.extend({
      name: DS.attr('string')
    });
    store = DS.Store.create();
    store.loadMany(Person, array);
  }
});

test("when a DS.Model updates its attributes, its changes affect its filtered Array membership", function() {
  var people = store.filter(Person, function(hash) {
    if (hash.get('name').match(/Katz$/)) { return true; }
  });

  equal(get(people, 'length'), 1, "precond - one item is in the ModelArray");

  var person = people.objectAt(0);

  equal(get(person, 'name'), "Scumbag Katz", "precond - the item is correct");

  Ember.run(function() {
    set(person, 'name', "Yehuda Katz");
  });

  equal(get(people, 'length'), 1, "there is still one item");
  equal(get(person, 'name'), "Yehuda Katz", "it has the updated item");

  Ember.run(function() {
    set(person, 'name', "Yehuda Katz-Foo");
  });

  equal(get(people, 'length'), 0, "there are now no items");
});

test("when a new record depends on the state of another record, it enters the pending state", function() {
  var id = 0;

  var store = DS.Store.create({
    adapter: DS.Adapter.create({
      createRecord: function(store, type, record) {
        var hash = record.toJSON();
        hash.id = ++id;
        store.didCreateRecord(record, hash);
      }
    })
  });
  var Comment = DS.Model.extend();

  var parentComment = store.createRecord(Comment);
  var childComment = store.createRecord(Comment);

  childComment.waitingOn(parentComment);

  equal(get(childComment, 'isPending'), true, "Child comment is pending on the parent comment");

  Ember.run(function() {
    store.commit();
  });

  equal(get(parentComment, 'isLoaded'), true, "precond - Parent comment is loaded");
  equal(get(parentComment, 'isDirty'), false, "precond - Parent comment is not dirty");
  equal(get(childComment, 'isPending'), false, "Child comment is no longer pending on the parent comment");
});

test("when an updated record depends on the state of another record, it enters the pending state", function() {
  var id = 0,
      parentComment;

  var store = DS.Store.create({
    adapter: DS.Adapter.create({
      createRecord: function(store, type, record) {
        var hash = record.toJSON();
        hash.id = ++id;
        store.didCreateRecord(record, hash);
      },

      updateRecord: function(store, type, record) {
        equal(get(parentComment, 'id'), 2, "parent record has been assigned an id");
        equal(record, childComment, "updated record is the child");
        store.didUpdateRecord(record);
      }
    })
  });

  var Comment = DS.Model.extend({
    title: DS.attr('string')
  });

  var childComment = store.createRecord(Comment);

  Ember.run(function() {
    store.commit();
  });

  parentComment = store.createRecord(Comment);

  childComment.set('title', "foo");

  equal(childComment.get('isDirty'), true, "precond - record is marked as dirty");
  equal(childComment.get('isNew'), false, "precond - record is not new");
  equal(parentComment.get('isNew'), true, "precond - parent record is new");

  childComment.waitingOn(parentComment);

  equal(get(childComment, 'isPending'), true, "Child comment is pending on the parent comment");

  Ember.run(function() {
    store.commit();
  });

  equal(get(parentComment, 'isLoaded'), true, "precond - Parent comment is loaded");
  equal(get(parentComment, 'isDirty'), false, "precond - Parent comment is not dirty");
  equal(get(childComment, 'isPending'), false, "Child comment is no longer pending on the parent comment");
});

test("when a loaded record depends on the state of another record, it enters the updated pending state", function() {
  var id = 0,
      parentComment, childComment;

  var store = DS.Store.create({
    adapter: DS.Adapter.create({
      createRecord: function(store, type, record) {
        var hash = record.toJSON();
        hash.id = ++id;
        store.didCreateRecord(record, hash);
      },

      updateRecord: function(store, type, record) {
        store.didUpdateRecord(record);
      }
    })
  });

  var Comment = DS.Model.extend({
    title: DS.attr('string')
  });

  childComment = store.createRecord(Comment);

  Ember.run(function() {
    store.commit();
  });

  equal(childComment.get('isDirty'), false, "precond - record is not marked as dirty");
  equal(childComment.get('isNew'), false, "precond - record is not new");

  parentComment = store.createRecord(Comment);
  childComment.waitingOn(parentComment);

  equal(get(childComment, 'isDirty'), true, "child comment is marked as dirty once a dependency has been created");
  equal(get(childComment, 'isPending'), true, "Child comment is pending on the parent comment");

  Ember.run(function() {
    store.commit();
  });

  equal(get(parentComment, 'isLoaded'), true, "precond - Parent comment is loaded");
  equal(get(parentComment, 'isDirty'), false, "precond - Parent comment is not dirty");
  equal(get(childComment, 'isPending'), false, "Child comment is no longer pending on the parent comment");
});

test("when a record depends on another record, we can delete the first record and finish loading the second record", function() {
  var id = 0,
      parentComment, childComment;

  var store = DS.Store.create({
    adapter: DS.Adapter.create({
      createRecord: function(store, type, record) {
        var hash = record.toJSON();
        hash.id = ++id;
        store.didCreateRecord(record, hash);
      },

      updateRecord: function(store, type, record) {
        store.didUpdateRecord(record);
      }
    })
  });

  var Comment = DS.Model.extend({
    title: DS.attr('string')
  });

  parentComment = store.createRecord(Comment);
  childComment = store.createRecord(Comment);

  childComment.waitingOn(parentComment);
  childComment.deleteRecord();

  equal(get(childComment, 'isDeleted'), true, "child record is marked as deleted");
  equal(get(childComment, 'isDirty'), false, "child record should not be dirty since it was deleted and never saved");
  equal(get(parentComment, 'isDirty'), true, "parent comment has not yet been saved");

  Ember.run(function() {
    store.commit();
  });

  equal(get(parentComment, 'isDirty'), false, "parent comment has been saved");
  ok(true, "no exception was thrown");
});
