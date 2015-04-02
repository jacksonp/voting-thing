function PeopleViewModel (myEmit) {
  'use strict';

  var self = this;

  self.me = new Person(localStorage.getItem('name'));

  self.people = ko.observableArray([]);

  function getPerson (id) {
    return ko.utils.arrayFirst(self.people(), function (p) {
      return p.id === id;
    });
  }

  self.removeAll = function () {
    self.people.removeAll();
  };

  self.addPeople = function (people) {
    $.each(people, function (k, u) {
      self.addPerson(u.person_id, u.name);
    });
  };

  self.addPerson = function (id, name) {
    var person = getPerson(id);
    if (!person) {
      self.people.push(new Person(name, id, id === self.me.id));
    }
  };

  self.removePerson = function (id) {
    self.people.remove(function (item) {
      return item.id === id;
    });
  };

  self.renamePerson = function (id, name) {
    var person = getPerson(id);
    if (person) {
      person.name(name);
    } else {
      self.addPerson(id, name);
    }
  };

  self.editName = function () {
    var newName = window.prompt('What is your name?', self.me.name());
    if (!newName) {
      return;
    }
    newName = newName.trim().substring(0, 20);
    if (!newName) {
      return;
    }
    myEmit('name change', {new_name: newName});
    self.me.name(newName);
    localStorage.setItem('name', newName);
  };

}